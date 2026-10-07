# Phase 7 working spec: wave 8 (cycle 8, Age of Apocalypse)

This is the shared brief for every agent working Phase 7's eighth content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3) and open questions with proposed defaults (§4). The model is
`docs/phase7-wave7.md`; wave 1–7 §3 primitives are assumed. The definition of done is
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
| 2a     | Bishop, Magik and the box's player cards                                                                 | placeholder |
| 2b     | Iceman, Jubilee                                                                                          | placeholder |
| 2c     | Nightcrawler, Magneto                                                                                    | placeholder |
| 3      | Ordered engine build queue                                                                               | placeholder |

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
- **Not in pass 1:** the hero packs. Placeholders are marked **(pass N)**; a card of a later pass is named here only
  to show that a primitive composes.
- **Data state (2026-10-07):** `iceman`, `jubilee`, `ncrawler` and `magneto` are emitted as data-only packs under
  `packages/content/src/data/`; `aoa` is raw only (`packages/content/raw/marvelcdb/aoa.json`, 195 records). The data
  survey (`docs/phase7-wave8-data-survey.md`) landed after pass 1a; pass 1b answers its gaps 3, 7, 8, 14 and 17 and
  its open questions 3 and 5 (§1.12–§1.22); pass 1c answers its gaps 4, 5, 6, 9, 10, 11 and 19 and its open questions
  2, 3 and 10 (§1.23–§1.31).

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
text) and a record 45062a / 45085a whose `linked_card` is the b face. The data agent emits one `MainSchemeCard` each,
as every earlier box. Raw `base_threat_fixed: true` with `base_threat: 0`; `threat_fixed: false` and
`escalation_threat_fixed: false` are the per player icons the scans show. **No schema change.**

### 1.5 Gene Pool: a side scheme with permanent and setup

`SideSchemeCard`, `keywords: [permanent, setup]`, `startingThreat` 4 flat (raw `base_threat_fixed: true`), no icons, in
the modular set `infinites`. Both keywords exist; setup step 11 puts setup cards into play
(`packages/cards/src/setup-keyword-set-aside.test.ts`). **No schema change**; behavior in §3.4.

### 1.6 The four Horsemen: four villains in play, one stage each, an A and a B face

MC45 p. 11: "Each of the Horsemen villains has a side A and a side B … To play the scenario in skirmish or standard
mode, use each villain's side A. To play the scenario in expert or heroic mode, use each villain's side B."

- **The Wrecking Crew shape** (`VillainStageRange`, `schema/sets.ts`: "For villains printed with version letters the
  numbers are positions (A = 1, B = 2)"): each Horseman is one `VillainCard` with two stages, A (45081a: 9[per_hero]
  hit points) and B (45081b: 12[per_hero]), and the scenario has `villainStages: { standard: [1, 1], expert: [2, 2] }`.
  Raw gives each as record `4508Na` with `linked_card` `4508Nb`. Not the Marauders shape (`expertVillains`), which has
  no multiple-villain form.
- **`Scenario.multipleVillains`** exists (`schema/sets.ts`): `villains` the four (each `encounterSetIds: []`),
  `encounterDecks: "shared"`, `activation: "activeVillainOnly"`, `winCondition: "allVillainsDefeated"`, `atSetup:
"setAside"` (the 1A Setup puts them into play in a random order, as Sinister Synchronization 1A does for the Sinister
  Six). **No schema change.** The row order is game state, not data (§3.7).
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

| Field                      | `unus`                                    | `four-horsemen`                                |
| -------------------------- | ----------------------------------------- | ---------------------------------------------- |
| `villainCardId`            | Unus                                      | War (the first of `multipleVillains.villains`) |
| `mainSchemeCardId`         | 45062                                     | 45085                                          |
| `encounterSetIds`          | `unus`, `infinites` (required, MC45 p. 8) | `four_horsemen`                                |
| `recommendedModularSetIds` | `dystopian_nightmare`                     | `dystopian_nightmare`, `hounds`                |
| `modularSetCount`          | 1 (absent)                                | 2                                              |
| `standardEncounterSetIds`  | `standard`                                | `standard`                                     |
| `expertEncounterSetIds`    | `expert`                                  | `expert`                                       |
| `villainStages`            | standard `[1, 2]`, expert `[2, 3]`        | standard `[1, 1]`, expert `[2, 2]`             |
| `multipleVillains`         | absent                                    | §1.6                                           |
| `victory`                  | absent (final villain stage)              | absent (`winCondition: "allVillainsDefeated"`) |

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
  Sinister's three sets (wave 7 §3.29): `GameSetupConfig.setAsideModularSets` and `setAsideUntilCalled`, no data
  field (the survey's gap 17). §3.23.

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

One two-stage `MainSchemeCard` deck for scenario 5 and a one-stage card for scenario 4. The star is the reminder for
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
| `mainSchemeCardId`         | 45103                              | 45121                                               | 45147 (stages 1 and 2)             |
| `encounterSetIds`          | `apocalypse`, `prelates`           | `dark_beast`, `savage_land`, `genosha`, `blue_moon` | `en_sabah_nur`                     |
| `recommendedModularSetIds` | `dark_riders`, `infinites`         | `dystopian_nightmare`                               | `celestial_tech`, `clan_akkaba`    |
| `modularSetCount`          | 2                                  | 1 (absent)                                          | 2                                  |
| `standardEncounterSetIds`  | `standard`                         | `standard`                                          | `standard`                         |
| `expertEncounterSetIds`    | `expert`                           | `expert`                                            | `expert`                           |
| `villainStages`            | standard `[2, 4]`, expert `[3, 4]` | standard `[1, 2]`, expert `[2, 3]`                  | standard `[1, 2]`, expert `[2, 3]` |
| `victory`                  | `"cardAbility"`                    | absent (final villain stage)                        | absent (final villain stage)       |

45103a: "Apocalypse, Prelates, and Standard sets. Two modular sets (Dark Riders and Infinites)". 45121a: "Dark Beast,
Blue Moon, Genosha, Savage Land, and Standard sets. One modular set (Dystopian Nightmare)". 45147a: "En Sabah Nur and
Standard sets. Two modular sets (Celestial Tech and Clan Akkaba)". Each matches its rulebook page. No 1A names the
Expert set (§1.10).

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
| `currentMission`, `currentOverseer`                                | shared   | `choice`, `working`                             | not on the sheet: this scenario's draw, for Victory to strike       |
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
   3[per_hero] threat." A setup option of the Infinites set, in any scenario that includes it (§3.5, §4.2 Q1).
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

1. Appendix II steps 1–7 as usual. **Step 8**: the four villain cards (A faces; B in expert) and the main scheme.
   **Step 9**: each villain has its own dial (MC45 p. 11, "Multiple Villains"), 9[per_hero] or 12[per_hero].
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
   - Set aside: the five Prelates and The Tyrant's Throne (the scenario builder's `GameSetupConfig.setAside`). Heart
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
   states the set-aside sets up front. §3.23.
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
  one that started the game in play (p. 6), defeated or not. Their order is the campaign's seed. Protect the Professor
  is always the fifth.
- **At least one Overseer is always available.** One is struck per win at most, and only if it was defeated that
  game; scenario 5 has between one and five to draw from.
- **A loss changes nothing.** The Victory list does not run, so the mission is not struck and the Overseer is not,
  even if it was defeated in the lost game; cards removed from the game during the game are back. Whether the retry
  draws the same mission and Overseer is §4.2 Q22.
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
   writes it to `currentMission` (scenario 5: no draw, Protect the Professor). In the game the mission is revealed
   (p. 5: "randomly select one of the available [MISSION] side schemes … and reveal it"): it enters play in the
   **mission area** with 5[per_hero] threat. Then its row's Setup cell (§2.14).
4. **The Overseer.** One unstruck option of `overseers`, written to `currentOverseer`; the minion is put into play
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
- "Players may attach upgrades to allies in the mission area." §4.2 Q19.
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

| §    | Primitive                                                                                          | Needed by                                                      | Status           |
| ---- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| 3.1  | Find, and "find … and reveal it" when the card is already in play                                  | 45075b, 45097                                                  | extend           |
| 3.2  | An amplify icon a character gains under a condition                                                | 45059–45061; printed on 45089                                  | exists (verify)  |
| 3.3  | Keywords, an icon and hit points gained at threat thresholds on a named card                       | 45059–45061, 45067, 45069                                      | exists (compose) |
| 3.4  | A permanent, setup side scheme that stays in play with no threat                                   | Gene Pool 45071; 45062a                                        | exists (verify)  |
| 3.5  | A setup option that belongs to a modular set                                                       | Infinites (MC45 p. 8, "Modular Difficulty")                    | extend           |
| 3.6  | Standard III: a counted environment that flips; replacing the Standard set                         | 45075a/b–45080                                                 | extend           |
| 3.7  | Villains in a random row; the active counter passes to the next in the row                         | 45085a/b, 45091, 45096                                         | extend           |
| 3.8  | "After a villain activates" with several villains                                                  | 45085b; 45092–45095                                            | exists (verify)  |
| 3.9  | Villains that cannot be defeated while another has hit points                                      | 45081–45084 a/b                                                | exists (verify)  |
| 3.10 | "Is considered to have at least 1 hit point"                                                       | Golden Horse 45090, Metal Wings 45091, 45096                   | new              |
| 3.11 | Another card's Forced Response resolved "as if it just attacked you"                               | 45090, 45091, 45096                                            | extend           |
| 3.12 | A named enemy activates; no boost card; "after this activation"; extra boost                       | 45067, 45092–45095                                             | exists (compose) |
| 3.13 | An identity's text box blanked "until the next villain phase begins"                               | Pestilence 45083a/b, Plague and Pestilence 45088               | extend           |
| 3.14 | Attach hosts of this pass; an attachment that moves the active counter                             | 45066, 45090, 45091, 45099                                     | exists (verify)  |
| 3.15 | A random side scheme of a set revealed by each player at setup                                     | 45085a                                                         | exists (verify)  |
| 3.16 | A forced change to hero form; the first copy revealed each phase gains surge                       | Hound 45098, Release the Hounds 45100                          | exists (verify)  |
| 3.17 | Reusable as is                                                                                     | the rest                                                       | checked          |
| 3.18 | A villain's next stage revealed when the main scheme is completed                                  | Apocalypse 45101a/b, 45102a/b                                  | extend           |
| 3.19 | A target threat of X per player, X read from the villain's printed hit points                      | 45103b, 45111                                                  | extend           |
| 3.20 | "When [the villain] would be defeated … instead", printed on the main scheme                       | 45103b                                                         | exists (compose) |
| 3.21 | An attachment that ignores a named ability; winning when the villain falls                         | No Longer Worthy 45105b                                        | new              |
| 3.22 | Chained side schemes locked while a trait's minion is in play                                      | 45104a/b, 45105a; Prelates 45179b–45183b                       | exists (verify)  |
| 3.23 | Whole sets set aside; one environment revealed at random, its set shuffled in                      | 45118–45120, 45121a, 45127, 45133, 45139                       | exists (verify)  |
| 3.24 | "Resolve the 'Special' ability on the [SETTING] environment"                                       | fifteen cards of scenario 4                                    | extend           |
| 3.25 | An attachment with no "attach to" that attaches from its own When Revealed                         | Cruel Experiment 45124                                         | extend           |
| 3.26 | A three-sided villain that changes to a named form                                                 | 45184–45186 a/b/c, 45149–45155                                 | extend           |
| 3.27 | Named counters on the main scheme that reveal a trait's card at a threshold                        | 45147b, 45148a/b, 45150–45152                                  | exists (compose) |
| 3.28 | An attachment's Forced Interrupt resolved "as if" its trigger just happened                        | Celestial Tech 45158; 45156, 45157                             | extend           |
| 3.29 | A permanent side scheme that sheds threat at a threshold; redirected threat                        | Ancient Ritual 45163, 45159–45162                              | exists (verify)  |
| 3.30 | Cards from a player's deck attached facedown to a minion, and counted                              | Abyss 45181b                                                   | exists (verify)  |
| 3.31 | An attachment on an identity that minions of a trait seek out                                      | Escaped Mutant 45137, 45134, 45135, 45138                      | exists (verify)  |
| 3.32 | Reusable as is (pass 1b)                                                                           | the rest                                                       | checked          |
| 3.33 | An in-play scenario area no player controls, closed to abilities that do not name it               | every card of §1.24–§1.28; MC45 p. 5                           | new              |
| 3.34 | An ally played into that area: the choice, no controller, a blank text box, upgrades               | every ally in a campaign game; 45176                           | extend           |
| 3.35 | A support the first player controls that cannot be discarded; a discount by destination            | Mission Team 45171a/b                                          | extend           |
| 3.36 | Discarded cards paired one each with characters, matched by resource icon                          | Mission Team 45171a; Mister Sinister 45179a                    | new              |
| 3.37 | A damage pool dealt to one enemy at a time; threat removed by a total that is not a thwart         | Mission Team 45171a                                            | extend           |
| 3.38 | A Forced Response to one ability's deck discard ("Mission Response"); a discarded card that leaves | 45180a–45183a; Digging Deep 40060                              | exists (verify)  |
| 3.39 | A named moment a script raises and other cards answer                                              | 45166a–45170a ("After you resolve a mission attempt")          | new              |
| 3.40 | A side scheme nobody thwarts, kept in play by a minion, that flips to a face that clears the area  | 45166a/b–45170a/b                                              | exists (compose) |
| 3.41 | Minions in the area: dashed stats, never engaged, shielded by another minion                       | 45179a–45183a, Agent of Apocalypse 45164                       | exists (verify)  |
| 3.42 | A resource icon a character is considered to have; an obligation that lives in a player's deck     | Desperate Measures 45176; Panicked Refugees 45178; 45172–45175 | extend           |
| 3.43 | "[A title] cannot enter play during this game"                                                     | MC45 p. 20 (scenario 5)                                        | extend           |
| 3.44 | A card found at campaign setup that counts toward the starting hand                                | MC45 pp. 8, 12, 14, 16, 20                                     | extend           |
| 3.45 | The campaign definition: random strike lists, three-cell rows, rewards, a win that loses           | the log (MC45 p. 24); all five scenarios                       | exists (verify)  |
| 3.46 | One printed card as two cards: an Overseer in play and its Prelate face                            | 45179a/b–45183a/b in scenario 3                                | extend           |
| 3.47 | Reusable as is (pass 1c)                                                                           | the rest                                                       | checked          |

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
of the scenario. Default value: §4.2 Q1.

**Tests.** 2 players, option 2 per player: Gene Pool 8 after setup, so Unus has retaliate 1 and stalwart at once.
Option 0: 4. The option is absent for a game without the Infinites set.

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
- It moves the counter one place from the villain that **holds** it, whichever villain activated (§4.2 Q5).
- An activation replaced by a stunned or confused card is not an activation, so the counter does not move (§4.2 Q4).
- Overkill from an attack that defeats a minion is dealt to the villain with the active counter (RRG p. 62 FAQ).

**Tests (exact numbers).** Row [War, Famine, Pestilence, Death], 1 player, counter on War.

1. Horseman of Death revealed in step four: Death heals 2, gets a tough card, attacks; the counter goes War → Famine.
2. War attacks with Horseman of Famine as his boost card: War's attack finishes; 1B moves the counter to Famine; then
   Famine activates with no boost card; 1B moves it to Pestilence. Next round Pestilence is active.
3. War stunned (one stunned card, no steady): the stunned card is discarded, no attack, counter still on War.
4. A hero's overkill attack defeats a Hound with 3 excess while the counter is on Famine: Famine takes 3.

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
- If No Longer Worthy leaves play it is removed from the game and cannot return (§4.2 Q13).

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

| Card                                                                                          | The resolving player                                |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Dark Beast 45118–45120: "When Dark Beast attacks you"                                         | the attacked player, before the attack's damage     |
| High-Tech Goggles 45122, Genetic Enhancement 45123: "Hero Action: Exhaust your hero and … →"  | the player using the action (a cost)                |
| Escaped Mutant 45137: "Alter-Ego Action: Resolve … → discard this card"                       | the player using the action (a cost)                |
| Pterosaur 45128, Oracle 45141, Manta 45142, Earthquake 45143, Warstar 45144; Land Out of Time | the revealing player                                |
| Giant Ape 45130: "The player who defeated Giant Ape resolves"                                 | that player; none if no player did (wave 7 §4.1 Q2) |
| Village Under Attack 45132: "Each player resolves"                                            | each player, in player order                        |
| Armored Unibike 45135: "After Armored Unibike attacks, resolve"                               | the player it attacked                              |
| Genoshan Mech 45136: "attacks and defeats one of your allies, resolve … twice"                | that ally's controller, twice in a row              |
| Imperial Guardsman 45145: "When attached minion is defeated, resolve"                         | §4.2 Q14                                            |

**Rules.** RRG 1.8 "Special" (p. 40: "Special abilities may only be resolved through the explicit instruction of
another card ability"); "You, Your" (p. 49); "Cost" (p. 13); "Player Deck" (p. 33); "Indirect Damage" (p. 24).

**As read.**

- "The [SETTING] environment" is the one in play. With none in play nothing resolves, and an ability whose cost is the
  Special cannot be used. With two in play (possible only outside Dark Beast): §4.2 Q15.
- Land Out of Time 45131 reads the Special's result: "resolve its 'Special' ability and take 1 indirect damage for
  each resource icon on the discarded cards". The Savage Land's Special binds its discarded cards; the treachery reads
  `totalPrintedResources` of `<bind>.discarded`.
- A cost that changes nothing follows §4.2 Q7 (The Savage Land with an empty deck and discard pile).
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
- Stage I defeated: the next stage's face is §4.2 Q16. It is a reveal, not a change of form, so no face's Forced
  Response resolves for it.

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
  cost, THW, ATK, hit points, consequential icons and resource icon are not text box. A granted stat (Desperate
  Measures) applies.
- **Upgrades.** A player may play an upgrade whose printed host is an ally onto an ally at the mission: the rules
  block names the area, so the play's host choice may reach into it (`inScenarioPlayArea` on the upgrade's host
  query while the rule is in effect). The upgrade is in the area with its host and under no player's control. What
  it then does is §4.2 Q19 (default A: its constant changes to its host apply; nobody can trigger it).

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

- **Desperate Measures.** +1 THW, +1 ATK and +1 hit point are stat modifiers on the host. "Is considered to have a
  wild ([wild]) resource icon in addition to its printed resource icon" is **`RuleSpec consideredResourceIcon {
target, resource }`**, read by one reader today, §3.36's match. It does not change what the ally card would pay
  with from a hand (the upgrade is in play and so is the ally). On an ally in a player's own area it gives the stats
  and an icon nothing reads.
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
- "From any aspect" and the deck-size exemption: §4.2 Q24, Q25. A grant today is exempt from the minimum and the
  maximum (`CampaignSeatInput.grantedCardIds`).
- An expert campaign is not lost by losing scenario 5: this box prints no such sentence (foundation row 15 lists the
  boxes that do, and MC45 is not among them), so the definition has no `defeat` block.

**Tests (exact numbers).** A seeded standard campaign, 2 seats.

1. Scenarios 1 to 4 draw four different missions; the same seed draws the same order; after four wins `missions` has
   four struck names and four result fields are set.
2. Evacuate Survivors drawn in scenario 2 and not defeated: scenarios 3, 4 and 5 each start with 1 Panicked Refugees
   in each deck (2 in the game). Defeated instead: the four copies are removed from the campaign and each
   seat holds one granted upgrade.
3. Liberate the Seattle Core defeated in scenario 1: in scenario 2 each player is offered 1 Desperate Measures; one
   accepts: 1 copy is in that deck and none in the other.
4. Find Lost Mutants defeated: two seats pick different allies; the two unpicked are simply unused. Not defeated:
   all four are removed from the campaign.
5. Sugar Man defeated in a won scenario 1: scenarios 2 to 5 never draw him. Defeated in a lost scenario 1: the retry
   may.
6. Scenario 5 won with Protect the Professor defeated: status `won`. Won with it on its a face: status `lost`.
   Lost because it failed: the node is retried.
7. Expert: a seat recorded at 4 of 12 starts scenario 2 at 4 hit points; paying, it is at 12 and the mission at
   10 + 3 = 13. A seat eliminated in a won scenario 1 has no record, must pay, and made no pick in scenario 1's
   Defeated cell.

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
the log and Abyss drawn: 45182b is in the game (the ruling), 45181b is not. Standalone: five Prelates.

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

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

Questions 1 to 10 were answered by the owner on 2026-10-07 (the project thread; his notes in full are in
`docs/phase7-wave8-handoff.md`). Nine follow the proposed default; **Q9 does not**. Questions 11 on are open.

| Q   | Decision                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **A.** A setup control, off unless the players turn it on. The rulebook's amounts are recommendations and are never applied silently.                                                                                                                                                                                                                             |
| 2   | **A.** Pursued by the Past's Forced Response resolves when the counter is placed and removes every counter before the treachery reaches "Then, if it has any counters".                                                                                                                                                                                           |
| 3   | **A.** The players in the game now; nothing snapshots the starting count.                                                                                                                                                                                                                                                                                         |
| 4   | **A.** A stun or confuse replaces the activation, so the villain did not activate and the active counter stays.                                                                                                                                                                                                                                                   |
| 5   | **A, firm.** Any Horseman's activation moves the counter, and always one place from the villain holding it, never from the villain that activated. The owner cites an FFG ruling on Hall of Heroes' post-RRG-1.5 rulings page (not in this repo). Test: Death holds the counter, a treachery makes War activate, the counter moves to the villain right of Death. |
| 6   | **A.** "Considered to have at least 1 hit point" is a game-state modifier every reader sees, including the other Horsemen's "cannot be defeated while another villain has at least 1 hit point".                                                                                                                                                                  |
| 7   | **A.** The normal valid-target and initiation rule: Golden Horse and Metal Wings are not offered when the simulated Forced Response can do nothing.                                                                                                                                                                                                               |
| 8   | **A.** The extra boost card is set up for the activation; the tough status card and the heal resolve after it.                                                                                                                                                                                                                                                    |
| 9   | **B.** A per-villain A/B picker for the Four Horsemen. The four selectors default from the difficulty (A/A/A/A for skirmish and standard, B/B/B/B for expert and heroic) and each can be overridden (MC45 p. 11). No "extreme" mode. §1.6, §2.3 and §5's client ask are read with this answer.                                                                    |
| 10  | **A.** Standard III may replace the Standard set on any scenario that uses it.                                                                                                                                                                                                                                                                                    |

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

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`:** emit the six sets of this pass with §1.2–§1.9: one main scheme record each from the
  duplicated raw pairs (§1.4); the Horsemen as four two-stage villains (§1.6); Pursued by the Past as one two-face
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
  and the reset threshold on Pursued by the Past; the setup controls of Q1, Q9 and Q10 once answered.

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
  counters and the threshold of 4; the setup option of Q12 and the confirmation of Q13 once answered.

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
  (§3.35 test 2: the discount does not outlive the phase). Fixtures for the exact-number tests of §3.33–§3.37 and
  §3.40. Campaign tests of §3.45: each mission won and failed, the reward and the cost carried to the next scenario,
  a retry after a loss in which the Overseer was defeated, scenario 5 won three ways, a seat eliminated in a won
  expert game. Report, do not fix, the two repo documents that read the log's columns backward (§0.2).
- **`game-client-engineer`** (design first; MC45 is a box that needs a design pass, `docs/campaign-client-per-box.md`
  §3, whose MC45 row is corrected by §0.2):
  - **Dossier (the log).** Per seat: identity and, in an expert campaign, remaining hit points. The four missions in
    the sheet's order with their three cells (Setup, Defeated, Not Defeated) readable in full; a struck row marked
    with the cell that applied (the result the paper sheet has no box for); the five Overseer boxes, struck ones
    marked. What carries: Desperate Measures on offer each game, Panicked Refugees each game, North American Sea
    Wall each game, each seat's granted upgrade, support and campaign ally; cards removed from the campaign shown as
    such.
  - **Briefing, every scenario.** The mission drawn and the Overseer drawn, shown as drawn, not chosen, with both
    faces of the mission and the Overseer's Mission Response in Inspect; the row's Setup cell and what its Defeated
    and Not Defeated cells will do; what the log carries into this game; in an expert campaign each seat's hit
    points and the heal's price (3 threat on the mission), with "must pay" for a seat that was defeated. Scenario 3:
    which Prelate is absent and why (Q21). Scenario 5: Protect the Professor, with both ways it ends the campaign,
    and "Professor X cannot enter play".
  - **Aftermath.** The strike; the row's cell applied; the picks: an upgrade or a support from any aspect is a
    collection-wide searchable picker (MC27's), a campaign ally is four cards with the ones taken marked; the
    Overseer struck or not, with the reason; scenario 5's two endings, including a won game that lost the campaign.
  - **In-game mission UI.** The mission area as its own region of the table, visibly apart from the villain's area
    and from every player's: the mission with its threat and attempt counters ("2 of 4"), the Overseer with damage
    and hit points and dashes for SCH and ATK, any Agent of Apocalypse, the allies there with their resource icon
    shown large and their hit points, upgrades on them, and facedown cards on Abyss as a count. A Mission Rules
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

## 6. Later passes (placeholders)

- **(pass 2a)** Bishop (45001a/b) and Magik (45030a/b), their nemesis sets, the box's aspect and basic cards; the RRG
  FAQ on Magik (p. 64). Start with the three things pass 1c leaves for it: Bishop's Energy Absorption and Magik's
  faceup top card both read the top of a deck that a mission attempt discards from (§3.36); the box's allies are the
  ones a campaign game plays to the mission, so each needs its printed resource icon and its "Play only if" line
  checked against a scan (§3.34); Sidekick (45015) attaches to "an identity-specific ally you control", which an ally
  at the mission is not (§3.33). **(pass 2b)** Iceman, Jubilee (ruling June 2, 2026 – Ruling 1). **(pass 2c)**
  Nightcrawler, Magneto.
- **(pass 3)** The ordered engine build queue over every §3 row.
