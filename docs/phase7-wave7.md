# Phase 7 working spec: wave 7 (cycle 7, NeXt Evolution)

This is the shared brief for every agent working Phase 7's seventh content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3) and open questions with proposed defaults (§4). The model is
`docs/phase7-wave6.md`; wave 1–6 §3 primitives are assumed. The definition of done is
`docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If you change a decision here, update this
file in the same change. Agents do not edit statuses or open questions; they report, and the main session flips them.

**Wave 7** is our `cycleId("cycle7")`. RRG 1.8 Appendix VI (p. 71), item 7: "The _NeXt Evolution_ campaign expansion,
the _Psylocke Hero Pack_, the _Angel Hero Pack_, the _X-23 Hero Pack_, and the _Deadpool Hero Pack_." Packs: `next_evol`
(MC40, with Cable and Domino), `psylocke`, `angel`, `x23`, `deadpool`. The spec is written in passes so each stays small:

| Pass   | Scope                                                                                                         | State       |
| ------ | ------------------------------------------------------------------------------------------------------------- | ----------- |
| **1a** | **The cycle's cross-cutting rules; Morlock Siege and On the Run; Military Grade, Mutant Slayers, Nasty Boys** | **written** |
| **1b** | **Juggernaut, Mister Sinister, Stryfe, their modular sets, and the Hope Summers set**                         | **written** |
| **1c** | **The MC40 campaign (setup and victory steps of all five scenarios) and campaign cards 190–203**              | **written** |
| **2a** | **Cable, Domino and the box's player cards**                                                                  | **written** |
| **2b** | **Psylocke, Angel**                                                                                           | **written** |
| **2c** | **X-23, Deadpool and the 'Pool aspect**                                                                       | **written** |
| **3**  | **Ordered engine build queue (§8)**                                                                           | **written** |

- **Pass 1a's content.** Player side schemes, the assault keyword, the per player icon on player cards and alliance
  (the rules every pack of the cycle leans on); scenario 1 Morlock Siege (main schemes 40077/40078, the seven Marauders
  villains 40070–40076, set `morlock_siege` 40079–40089) and scenario 2 On the Run (40103/40104, set `on_the_run`
  40105–40111); modular sets Military Grade (40090–40093), Mutant Slayers (40094–40102), Nasty Boys (40112–40117).
- **Pass 1b's content.** Scenario 3 Juggernaut (villain 40118–40120, main scheme 40121, set `juggernaut`
  40122–40129), scenario 4 Mister Sinister (40136–40138, main schemes 40139–40143, set `mister_sinister` 40144–40150)
  and scenario 5 Stryfe (40163–40165, main schemes 40166/40167, set `stryfe` 40168–40179); the Hope Summers set
  (40130, 40131), moved here from pass 1c because all three scenarios require it; modular sets Black Tom Cassidy
  (40132–40135), Flight (40151–40154), Super Strength (40155–40158), Telepathy (40159–40162), Extreme Measures
  (40180–40184) and Mutant Insurrection (40185–40189). Sections 1.10–1.17, 2.5–2.9, 3.22–3.39 and questions 14–23.
- **Pass 1c's content.** The NeXt Evolution campaign (MC40 pp. 6–7, the Campaign Instructions on pp. 9, 11, 14, 16
  and 18, the campaign FAQ on p. 21, the log sheet on p. 24) and the `next_evol_campaign` set: the six campaign player
  side schemes and their environments (40190a/b–40195a/b), Pouches (40196), Safehouse (40197) and the six encounter
  cards 40198–40203. Sections 1.19–1.21, 2.10, 3.40–3.48, questions 24–28 and §5.2. It also corrects two status lines
  of pass 1a (§3.15, §3.16).
- **Pass 2a's content.** The box's two heroes and every player card of the box (70 records): Cable / Nathan Summers
  (40001a/b), his signature cards 40002–40013, obligation 40031 and nemesis set 40032–40036; Domino / Neena Thurman
  (40037a/b), her signature cards 40038–40049, obligation 40065 and nemesis set 40066–40069; the aspect and basic
  cards 40014–40030 and 40050–40064; the basic ally Hope Summers (40204). Sections 3.49–3.61, questions 29–36, §5.3
  and §7. Card text was read from the emitted `packages/content/src/data/next_evol/cards.ts`, with the scans 40001b,
  40006, 40012, 40037a/b, 40045 and 40053.
- **Pass 2b's content.** The Psylocke and Angel hero packs (65 card codes): Psylocke / Betsy Braddock (41001a/b), the
  double-sided Psi-Knife / Psi-Katana (41002a/b), signature cards 41003–41011, obligation 41025 and nemesis set
  41026–41029; Angel / Warren Worthington III / Archangel (42001a/b/c), signature cards 42002–42010, obligation 42024
  and nemesis set 42025–42028; each pack's aspect and basic cards, the four outside the starter decks included
  (41030–41033, 42029–42032). Sections 3.62–3.72, questions 37–43, §5.4 and §7.2. Card text was read from the
  emitted `packages/content/src/data/{psylocke,angel}/cards.ts`, with the scans and the two pack inserts listed in §0.
- **Pass 2c's content.** The X-23 and Deadpool hero packs (98 card codes): X-23 / Laura Kinney (43001a/b), signature
  cards 43002–43012, obligation 43028, nemesis set 43029–43033, the aspect and basic cards 43013–43027 and
  43038–43040 and the four linked Specialist upgrades 43034–43037; Deadpool / Wade Wilson (44001a/b), signature cards
  44002–44012, the 'Pool aspect's 34 cards (44013–44030, 44043–44058), Frenemies 44031, obligation 44032, nemesis set
  44033–44036 and the `dreadpool` set 44037–44042. Sections 3.73–3.87, questions 44–53, §5.5 and §7.3. Card text was
  read from the emitted `packages/content/src/data/{x23,deadpool}/cards.ts`, with the scans and the two pack inserts
  listed in §0.
- **Pass 3's content.** §8: the status of all 87 §3 rows in one table (§8.1), the engine queue of 50 tasks in build
  order with the files, the cards each unblocks and the questions each depends on (§8.2), the "exists (verify)" rows
  by the scripting task that exercises them (§8.3), the 53 questions by urgency (§8.4), the scripting order per
  scenario, set and hero (§8.5) and two status disagreements found against the code (§8.6). No §3 status was changed.
- **Not in these passes:** anything a later pass owns, even where a card is named here to show a primitive composes.
  Placeholders are marked **(pass N)**.
- **Data state (2026-10-04):** `psylocke`, `angel`, `x23` and `deadpool` are already emitted as data-only packs under
  `packages/content/src/data/` (`data-only.test.ts` pins them to `cycle7`); `next_evol` is raw only
  (`packages/content/raw/marvelcdb/next_evol.json`, 216 records). The data survey is
  `docs/phase7-wave7-data-survey.md` (another agent).

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The NeXt Evolution rulebook, `docs/campaign-modes/mc40_next_evolution_rulebook-web.pdf` (24 pages), converted in
     `docs/campaign-modes/markdown/mc40_next_evolution.md`, cited as "MC40 p. N" (PDF page = printed page). Pages read
     for pass 1a: 2–7, 9, 11, 21, 24. Pages 8, 10, 12 and 13 are full-page art. Pass 1b read pp. 5, 14, 16, 18 and 21;
     pp. 15, 17, 19 and 20 are full-page art. The markdown of p. 14 prints the scenario's Victory bullets under the
     "Momentum Counters" heading (a column-order conversion slip). Pass 1c read pp. 6, 7, 9, 11, 14, 16, 18, 21 and
     24 and checked p. 14 against the PDF's text positions: the three Victory bullets are "Record the amount of damage
     on Hope Summers", "Mark each campaign environment in play as 'Earned'" and the expert hit point record; the two
     expert bullets about setting hit points and the facedown encounter card are Setup, as the markdown has them. The
     log sheet is `docs/campaign-modes/log-sheets/mc40_next_evolution_campaign_log-compressed.pdf` (the same page as
     MC40 p. 24; the markdown lists its six rows alphabetically, the sheet does not, and the pairings agree).
   - Card text: `packages/content/raw/marvelcdb/next_evol.json`, every record of the sets named above read for this
     pass, plus every `player_side_scheme` record of the five packs. Not an authority on its own. Scan read:
     `assets/card-art/bundles/cards/40092.png` (Inhibitor Collar; gitignored, never committed). Scans exist for
     40070a/b–40076a/b, 40077–40079, 40081a/b and 40053; the data agent should read 40081a/b and 40105a/b against the
     raw text before emitting them. Pass 1b read every record of its ten sets and the scans 40121b, 40130, 40163,
     40166b, 40168b and 40173 (what each showed is in §1.10–§1.17). Pass 1c read the 14 `next_evol_campaign` records
     (the six b faces are only in each a record's nested `linked_card`) and the scans 40190a, 40197, 40199 and 40202
     (§1.20).
   - (pass 2b) The Psylocke and Angel Hero Pack inserts, one sheet each, read as photographs linked from the Hall of
     Heroes pack pages (the "Insert" link; not in the repo, so quoted here): cited as "Psylocke insert" and "Angel
     insert". Angel insert, "Foldable Cards": "Warren Worthington III's identity card is a foldable, 'three-sided'
     card. One side is his alter-ego form, one side is his Angel hero form, and the inside of the card is his
     Archangel hero form. Changing form with a three-sided card follows the standard rules for changing form. While
     this identity card is in play (in any form), other characters with the title Angel or Archangel and the subtitle
     Warren Worthington III cannot enter play." Its strategy box names "Archangel's 0 THW and printed acceleration
     icon". Both inserts repeat the player side scheme, team-up, piercing and victory paragraphs; the Psylocke insert
     adds ranged. Card text: every record of `packages/content/src/data/{psylocke,angel}/cards.ts` and the raw caches;
     scans 41001a/b, 41002a/b, 41008–41011, 41024, 41025, 41030, 41032, 41033, 42001a/b/c, 42008, 42010, 42011,
     42013, 42015, 42024, 42027.
   - (pass 2c) The X-23 and Deadpool Hero Pack inserts, read as photographs linked from the Hall of Heroes pack pages
     (not in the repo, so quoted here): cited as "X-23 insert" and "Deadpool insert".
     - X-23 insert, "New Keyword: Linked (Card Title)": "Cards with the linked keyword cannot be included in a
       player's deck. Instead, they are set aside at the start of the game if any player's deck includes the card that
       brings the linked cards into play (indicated in the parentheses following the keyword). Linked cards do not
       count toward the minimum or maximum deck size." Its note: "This product comes with four cards linked to the
       player side scheme, Specialized Training (#21), found in X-23's pre-built deck."
     - Deadpool insert, "Using the 'Pool Aspect": "The 'Pool aspect counts as an aspect for all gameplay purposes. You
       can customize any hero's deck using the 'Pool aspect as your chosen aspect following the deck customization
       rules found in Appendix I of the Rules Reference." And: "When setting up a game in which at least one player is
       using the 'Pool aspect, shuffle 1 copy of the Crisis of Infinite Deadpools (#37) treachery card into the
       encounter deck. Set the rest of the Dreadpool modular encounter set aside. This encounter set is shuffled into
       the encounter deck when Crisis of Infinite Deadpools is revealed."
     - Deadpool insert, FAQ (seven entries, each used below): acceleration tokens and acceleration icons "are not
       equivalent"; Armed to the Teeth searches "all of your Marvel Champions cards outside of the current game for a
       card with the WEAPON trait from any aspect (which excludes campaign and identity-specific cards). This can be
       from an aspect different from your deck's chosen aspect"; "I Got This" "only checks that at least one such icon
       is in play"; Git Gud: "If you don't remember the outcome of your last Marvel Champions game, that probably
       means you didn't win that game and can take the discount … If this is your first time playing Marvel
       Champions, then you did not win your last game, so you can take the discount"; Rock, Paper, Scissors:
       "Resources do not have arrows pointing to themselves, so you do not add the discarded card to your hand. For
       that reason, wild resources do not 'beat' other wild resources"; Tic-Tac-Toe: "Three tokens are 'in a line' if
       they are all in the same row, in the same column, or on the same diagonal"; Adam Warlock: "The 'Pool aspect
       serves as a fifth aspect option for customizing Adam Warlock's deck. It can be used in place of any of the
       other four aspects … any other heroes who can include cards from more than one aspect in their deck can choose
       the 'Pool aspect as one of those aspects."
     - Deadpool insert, "Edited Cards": the 'Pool cards that rework Core Set cards "should be played using their
       improved text, including Deadpool's edits", abiding by the text in editor's boxes. The emitted text already is
       the edited text; Deadpool's hero face prints "200\*", "200\*" and "100\*" with "\*Ignore these zeroes" (THW 2,
       ATK 2, DEF 1, as emitted), and Wade Wilson's MUTANT trait carries a joke footnote and is an ordinary trait.
     - Scans read: 43001a/b, 43021, 43028, 44001a/b, 44009, 44013, 44021, 44024, 44032, 44046, 44053, 44055, 44056,
       44057, 44058. The Metagame cards' art is rules text; what each diagram shows is in §3.84 and §3.87.
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading.
   The ones this pass leans on:
   - Aug 3, 2026 (5): Team Investigation's "printed cost scales with player count: In a 2-player game, printed cost is
     **4**" (§1.3, §3.4).
   - Aug 3, 2026 (1): a player side scheme's defeat is a Forced Interrupt that follows interrupts to the last threat
     being removed (Acute Tactility on Focus the Senses); the engine's `schemeDefeated` order already matches (§3.1).
   - Feb 28, 2026 (4) #2: quickstrike resolves before When Revealed (Mutant Slayers grants quickstrike; teamwork follows
     wave 6 §4.1 Q2).
   - Jun 25, 2026 (4) #5: characters not under a player's control are not friendly (not needed for Morlock allies,
     which players control).
   - Aug 3, 2026 (4): negative victory values (Morlock's Victory -1 only matters to a campaign score; none in MC40).
   - Pass 1b: January 17, 2026 - Ruling 1, both answers (a star value is what its ability defines, Hope Summers; the
     "Leaves Play" bullets happen simultaneously with leaving, §3.25); January 26, 2026 - Ruling 4, answer 4 (Psychic
     Override: "any card type that exists in Marvel Champions, even if not in your hand or deck", §3.33) and answer 3
     (cards dealt to several players: AABB or BBAA, Sinister Ends 3A); July 9, 2026 - Ruling 3, answer 1 (Stryfe II
     revealed during setup: "Players always resolve Alter-Ego setup abilities regardless of setup form changes",
     §3.37); February 8, 2026 - Ruling 2 and August 3, 2026 - Ruling 6 (Thumbelina, §3.30, where the first is
     already superseded by a user decision).
   - Pass 1c: June 25, 2026 - Ruling 4, answer 5 ("Characters not under player control are not friendly characters":
     an ally Malice or 'Pool-ized treats as a minion) and answer 1 ("Nemesis sets belong to that identity": what set
     a card belongs to is not text, so a possessed ally still belongs to its set, §3.44); December 17, 2025 - Ruling 1,
     answer 3 (Beguiled: "the ally does not leave play and the 'minion' does not enter play … essentially a status
     change") and answer 1 (any player can trigger an Action on an encounter card: the campaign environments).
   - Pass 2a: April 30, 2026 - Ruling 4, answer 1 (Digging Deep's Response may be triggered when it is discarded
     during an Age of Apocalypse mission attempt; "if you do, it does not count for the mission attempt and no
     replacement card is drawn": the response is optional and takes the card out of what the discarding effect goes
     on to read, §3.55); August 3, 2026 - Ruling 5 again (Team Investigation, §3.4). No ruling in the file names
     Cable, Domino or any other card of this pass.
   - Pass 2b: January 26, 2026 - Ruling 6, answer 2 ("Limits apply to cards. An identity never leaves play when
     flipping; limits applied to its abilities persist across flips": Regrowth, Angel of Life and Angel of Death
     each keep their own limit through a form change, §7.2). The file was searched for every card title of both
     packs, both identities' face names and "Psi-": no ruling names any of them.
   - Pass 2c: December 17, 2025 - Ruling 4, answer 1 ("Once a card is removed from the game, it **cannot** be
     returned to the game by any means (e.g., _Armed to the Teeth_), and it does not become a part of the collection")
     and answer 3 (cards "in the game, out of play" differ from cards "outside the current game", §3.81); January 26,
     2026 - Ruling 4, answer 1 ("Headpool's controller resolves the minion's boost card", §3.87); June 2, 2026 -
     Ruling 5 (Exhausting Personality "specifically allows choosing any player's identity for its cost", §3.76); June
     25, 2026 - Ruling 4, answer 3 (Metaknowledge on a flipped environment: "**No.** Environments flip, they are not
     revealed", §3.87); August 3, 2026 - Ruling 4, answer 3 ("Linked cards cannot be included in decks", §3.75). The
     file was searched for every card title of both packs: no other ruling names one.
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page (every cite below checked
   against the PDF with pypdf: printed page = 1-based PDF page). Entries this pass leans on: "Alliance" (p. 6), "Ally
   Limit" (p. 7), "Assault" (p. 8), "Attacks Against Allies" and "Basic Power" (p. 10), "Card Types" and "Choose
   (Option)" (p. 12), "Cost" (p. 13), "Hinder X" and "Hit Points" (p. 22), "'Instead'" (p. 25), "Per Player Icon" and
   "Permanent" (p. 32), "Player Card" (p. 33), "Player Side Scheme", "Player Side Scheme Limit" and "Player Turn"
   (p. 34), "Printed" (p. 35), "Quickstrike" (p. 36), "Replacement Effect" (p. 37), "Scheme (Card Type)" (p. 39),
   "Steady" (p. 41), "Teamwork (Trait)" (p. 43), "Unique Icon" (pp. 45–46), "Victory X" (p. 46), "Villain Defeat"
   (p. 47), Appendix I's identity-extension list (p. 49: "Player Side Schemes — Triggered abilities that resolve from
   player side schemes in play under a player's control are **not** considered to be performed by that player's
   identity"). Cycle 7's FAQ is on p. 64 and its errata on p. 69; the one entry in this pass is Inhibitor Collar (#92).
   Pass 1b adds (same check): "All-Purpose Counter" (p. 6), "Attacks Against Allies" (p. 10), "'Cannot'" (p. 11),
   "Card Types" (p. 12), "Defeat" (p. 15), "Double-Sided Card" and "'Each Player'" (p. 17), "Excess Damage" and
   "First Player" (p. 19), "Flip" (p. 20), "Ignore" (p. 23), "Leaves Play" (p. 27), "Modifiers" (p. 29), "Overkill"
   (p. 31), "Permanent" (p. 32), "Setup (Keyword)", "Stalwart" and "Star Icon" (p. 40), "Status Cards" (p. 41),
   "Villain Defeat" (p. 47), "When Completed Abilities" (p. 48), Appendix II steps 11 and 12 (p. 51). No cycle 7 FAQ
   or erratum entry (pp. 64, 69) names a card of this pass.
   Pass 1c adds (same check): "Campaign-Specific Card" (p. 11), "Double-Sided Card" (p. 17), "First Player" (p. 19),
   "Flip" (p. 20), "Hinder X" (p. 22), "Modes of Play" (pp. 28–29: campaign mode, and "If a card is removed from a
   campaign, that card can no longer be used during the rest of the campaign, even if players retry the scenario
   wherein that card was removed"), "Player Elimination" and "Player Side Scheme" (p. 34), Appendix II step 14
   (p. 51), the FAQ entry **Malice (#199)** (p. 64) and the erratum **'Pool-ized (#41)** (p. 69; the sibling erratum
   Possessed (#38) is on p. 68).
   Pass 2a adds (same check): "Cancel" (p. 11: a canceled card "is still considered played"), "Form" (p. 21:
   "[type] form only" cards "can only be played or put into play by a player whose identity is in the specified
   form"), "Max X per" (p. 28), "Player Deck" (p. 33), "Ranged" (p. 36), "Side Scheme" (p. 40: "Each side scheme
   enters play with an amount of threat on it equal to the card's starting threat value"), "'Swap'" (p. 42),
   "Team-Up" (p. 43), "Victory Display" (p. 46: its cards "follow the standard rules for out-of-play cards"),
   "Villainous" (p. 47), Appendix I's extension list (p. 49: events, resources and upgrades are an extension of the
   identity; allies, encounter cards and player side schemes are not). MC40 p. 21 (the Cable and Domino FAQ) and
   p. 22 (the two starter decks). No cycle 7 FAQ or erratum entry (pp. 64, 69) names a card of this pass.
   Pass 2b adds (same check): "Acceleration Icon" (p. 5), "Basic Power" (p. 10), "Defense" (p. 15: a defense-labeled
   ability makes "that player's identity … the defender … if there is not already a defender"; "When an ally defends
   an attack, that ally becomes the target character"), "Flip" and "'For Each'" (p. 20; the latter's example is
   Flurry of Blades), "Form, Change Form" and "Hazard Icon" (p. 21), "Identity" and "Identity-Specific Card" (p. 23),
   "Indirect Damage" (p. 24), "Obligation" (p. 30), "Ownership and Control" (p. 31: "A player controls the cards in
   their own out-of-play areas (such as the hand, the deck, and the discard pile)"), "Permanent" and "Piercing"
   (p. 32), "Restricted" (p. 38), "Team-Up" (p. 43). No cycle 7 FAQ or erratum entry (pp. 64, 69) names a card of
   either pack.
   Pass 2c adds (same check): "Acceleration Token" (p. 5: "Acceleration tokens are not considered acceleration icons,
   and vice versa"; tokens on the main scheme "cannot be removed from play" and stay when the stage leaves play),
   "Aspect Card" (p. 8), "Classifications" (p. 12), "Cost" and "Damage" (p. 14: the nine-step order in which
   "would be defeated" precedes the discard of a defeated character, and "after [character] … takes any amount of
   damage" follows it), "Heal" and "Hit Points" (p. 22: "The phrase 'starting hit points' refers to an identity's
   printed hit point value"), "Linked (Card Title)" (p. 27), "Move" (p. 30), "Removed from the Game" (p. 36),
   "Restricted" (p. 38), "Search" and "Set Aside" (p. 39), "Wild Resource" (p. 48), Appendix I (p. 50), the FAQ
   entries Focused Rage (p. 57), **Honey Badger (#3)** and **Crisis of Infinite Deadpools (#37)** (p. 64), and the
   errata **'Pool-ized (#41)** and **Front Line Specialist (#36)** (p. 69).
4. **`docs/phase7-wave7-sources.md`**, checked by the main session. Where it differs, this file is the architect's
   reading; the differences are reported to the main session rather than edited:
   - Its §3.1 says "The RRG FAQ also has an entry for the campaign card Assault (#197)". That entry is on p. 58 under
     the **Core Set** heading and is about the Standard set's treachery Assault. `next_evol` 40197 is Safehouse. It has
     nothing to do with the assault keyword.
   - Its §2 lists "Pages 5–6: Campaign Mode Rules". MC40 p. 5 is Hope Summers, Attacks Against Allies, Per Player
     Costs, Victory Display and Amplify Icon; campaign mode rules are p. 6; campaign player side schemes and the
     expert campaign are p. 7.
   - Its §2 "Notable mechanics" calls player side schemes a "campaign-specific mechanic". The card type is general
     (13 in the box, 7 of them ordinary deck cards, and 6 more across the four hero packs); only 40190a–40195a are
     campaign cards. Its "environment adds threat to scenarios" is not what MC40 p. 11 prints for scenario 2 ("put that
     environment into play and give each enemy a tough status card"); scenarios 3–5 are pass 1c's to check.
   - Its §6 item 5 says "cost × playerCount in setup". RRG p. 32: "the number of players who **started** the scenario",
     read whenever the cost is read, not fixed at setup.
   - (pass 1b) Its §4 lists February 8, 2026 - Ruling 2 (Prince of Power "heals 3") as standing and says "Ruling
     versus RRG: no conflict found". That ruling measures excess on damage **dealt**; RRG 1.8 "Overkill" (p. 31)
     says an ability that counts excess damage "counts the same value … calculated when resolving the overkill
     keyword", and the user decided for the RRG on 2026-09-25 (`excessDamageOf`, `packages/engine/src/resolve/
event.ts`: "Prince of Power heals 2, not 3"). August 3, 2026 - Ruling 6, issued after RRG 1.8, again speaks of
     excess "dealt to overcome the reduction"; no cycle 7 card prints "exactly defeat", so nothing here reads it.
   - (pass 1b) Its §6 item 8 says the loss is "checked after any ally defeat". The card says "leaves play": any way of
     leaving (defeat, discard, return to hand, removal).
   - (pass 1b) Its §4 gives July 9, 2026 - Ruling 3 as a Stryfe II (40164) ruling "causing a form change". No card
     Stryfe II's When Revealed can reveal (40169–40173) changes a form; the ruling's answer is general and is used
     as such (§3.37).
   - (pass 1b) The data survey (§4.6, §4.8) does not list Psychic Inertia (40173): raw `scheme: -1, attack: -1`, the
     scan prints THW −1 and ATK −1 (an identity has no SCH). It also omits Stryfe I's ATK (40163: raw has no
     `attack`; the scan prints "0★") and calls Living Bomb's threat "3" beside "4 fixed" (both faces are fixed).
   - (pass 1c) Its §2 says campaign environments "add threat counters in subsequent scenarios". Only scenarios 4 and 5
     place threat (MC40 pp. 16, 18); scenario 2 gives each enemy a tough status card (p. 11) and scenario 3 places a
     momentum counter (p. 14). The same section says the expert heal costs "acceleration tokens"; that is scenarios 2
     and 4, and scenarios 3 and 5 cost a facedown encounter card.
   - (pass 1c) The data survey §4.6 cites the Malice FAQ as "RRG FAQ p. 56"; it is p. 64. It does not list raw
     40199's "**Threat** attached ally" (the scan prints "Treat").
   - (pass 2a) The markdown of MC40 p. 21 prints Domino's FAQ as "count each [physical] icon twice" and gives Outlaw
     "one printed [physical] resource". The icon is the wild icon (the card 40037a and Outlaw's data both say wild):
     a conversion slip, not a rulebook difference. The same page prints the Jackpot! answer after the Stryfe example
     (column order).
   - (pass 2b) Its pack table calls Angel's third face "an additional form, as MC32's 'Additional Forms'". It is not:
     MC32's additional forms are upgrades with the "[type] form" keyword (Shadowcat's mass forms). Angel is a foldable
     three-sided identity card, the Ant-Man and Wasp shape (Angel insert, "Foldable Cards"; wave 2 §1.1, §3.2), and
     the emitted record already uses `additionalHeroForms`. Its line "Confirm form-change mechanics" is §3.62.
   - (pass 2c) The data survey §5 says the four hero packs have "No precon / starter deck". Both packs of this pass
     now emit one (`x23/starterDecks.ts`: Aggression, 41 entries of which X-23's Claws is permanent;
     `deadpool/starterDecks.ts`: 'Pool, 40 cards). The same section cites the Crisis of Infinite Deadpools FAQ as
     "printed p. 57"; it is p. 64. `packages/engine/src/deck.ts`'s comment on `CHOOSABLE_ASPECTS` cites
     "Classifications" as p. 11 and that FAQ as p. 62: they are pp. 12 and 64 (a comment fix for whoever next edits
     the file). The x23 curation's note that Puncture Wound "resolves to no legal host" predates
     `GameState.attackedThisTurn` (`state.ts`, read in `resolve/reveal.ts`); verify and drop the note.
   - (pass 1c) `docs/campaign-mode-design.md` row 60 and `docs/campaign-client-per-box.md` §3 give MC40 "a campaign
     environment with Completed/Failed sides". That is MC60's card. MC40's six environments are the back faces of the
     campaign player side schemes and have no such sides (§1.20).

**Rulebook versus RRG, found in this pass** (each is an open question in §4.2, not decided here):

| Topic                                            | MC40                                                                | RRG 1.8                                                                        | §4.2 |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| "Attacks you" abilities when an ally is attacked | p. 5: "do **not** trigger"                                          | p. 10: "resolve against the attacked player"                                   | Q5   |
| A revealed minion matching the villain's title   | p. 21: discarded, "must reveal an additional encounter card"        | p. 46: discarded, "the player revealing it is dealt a facedown encounter card" | Q4   |
| Teamwork: who activates                          | p. 4: "each minion that shares the teamwork keyword … activates"    | p. 43: "the minion that just entered play activates"                           | —    |
| A setup-keyword card in a set-aside set (1b)     | p. 16: "ignored in this scenario because these cards are set aside" | p. 51 step 11: "Search each deck and the set aside area"                       | Q20  |

Teamwork is the same disagreement as MC32 p. 3, already decided by the user (wave 6 §4.1 Q1: RRG 1.8; Q2: before When
Revealed). It is not asked again; the Nasty Boys use the built keyword.

Pass 2a found no place where MC40 (pp. 21–22) or a ruling disagrees with RRG 1.8 for these cards.

Pass 2b found one place where RRG 1.8 disagrees with itself, and one where the inserts differ from it:

- "Restricted" (p. 38) says both "if a player **ever** controls more than two restricted cards in play, they must
  immediately choose and discard" and that the keyword "is equivalent to … **Forced Response**: After you take
  control of this card". A Psi-Knife that flips to the restricted Psi-Katana is the first case where the two differ
  (§3.64, §4.2 Q38).
- Both inserts say of the player side scheme limit that "the first player chooses and discards player side schemes".
  RRG 1.8 (p. 34) gives the choice to the player who played the scheme. That is Q1's subject, already asked; the
  inserts are the older wording (September 2023) and do not change its default.

Pass 2c found no ruling that disagrees with RRG 1.8 for these cards, and three places where the texts differ:

- RRG 1.8 disagrees with itself on the number of aspects. "Aspect Card" (p. 8) opens with four ("Aggression, Justice,
  Leadership, and/or Protection") and its first bullet says "one of the five aspects (Aggression, Justice,
  Leadership, Protection, or 'Pool)"; "Classifications" (p. 12) lists five; Appendix I (p. 50) says "exactly one
  aspect (Justice, Aggression, Protection, or Leadership)". The Deadpool insert ("an aspect for all gameplay
  purposes") and the FAQ on p. 64 ("chooses the 'Pool aspect as (one of) their chosen aspect(s)") both read five, and
  `validateDeck` is already built that way (§3.73). Not asked: the four-aspect sentences are text the 'Pool aspect's
  release did not update.
- The X-23 and Deadpool inserts repeat "the first player chooses and discards player side schemes" (Q1's subject, as
  in pass 2b).
- "Search" (p. 39) lets a collection search look through "all of their Marvel Champions cards outside of the current
  game"; the Deadpool insert narrows Armed to the Teeth's "from any aspect" to exclude campaign and identity-specific
  cards. That is the card's own filter, not a disagreement; whether a basic card is "from any aspect" is §4.2 Q47.

Pass 1c found no place where MC40's campaign rules and RRG 1.8 disagree. Two things that look like one and are not:
a defeated campaign player side scheme flips instead of being discarded (card text over RRG "Player Side Scheme",
p. 34, by "The Golden Rules", p. 4), and Malice stays in play after her defeat (her own When Defeated, read with the
FAQ on p. 64).

---

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **proposed (2026-10-04), nothing landed.** Every keyword this pass's cards print (alliance, assault, guard,
> hinder, patrol, permanent, quickstrike, retaliate, steady, stalwart, surge, teamwork, toughness, victory) is already
> a `KeywordInstance` in `packages/content/src/schema/keywords.ts`.

### 1.1 Player side scheme: the card type exists; three additions

`PlayerSideSchemeCard` (`packages/content/src/schema/cards/player-cards.ts`: `type: "player_side_scheme"`,
`CostedCard`, `resourceIcons`, `startingThreat: ScalingValue`) and its normalizer
(`packages/content/scripts/marvelcdb/normalize/player-cards.ts`) have existed since wave 1; the four hero packs' six
player side schemes are emitted with it. RRG 1.8 "Player Side Scheme" (p. 34), "Card Types" (p. 12: seven player card
types), MC40 p. 3 (anatomy: title, type, ability, cost, resources, starting threat, classification).

- **Starting threat.** Raw `base_threat` with `base_threat_fixed: false` is per player (Call for Backup 40018 prints
  "3[per_hero]", MC40 p. 3) → `perPlayerOnly(3)`; `base_threat_fixed: true` is flat (Technovirus Purge 40006, 5).
  The data agent confirms the emitted hero-pack cards follow this.
- **Addition 1, scheme icons.** `showingIconsOn` (`packages/engine/src/rules.ts`) returns `[]` for a player side
  scheme. `BaseCard.schemeIcons` already exists for non-scheme cards (wave 3 §1, the amplify icon); a player side scheme reads
  it too.
  Needed by Live Dangerously (`deadpool` 44024, amplify; pass 2c). No schema change, one engine line (§3.1).
- **Addition 2, a campaign player side scheme has no cost and an environment on its other face** (40190a–40195a:
  cost "–", "4[per_hero]", `linked_card` an environment). `cost: 0, specialCost: "dash"` and a `flipSide` of a
  different card type. Wave 2 §1 noted "a back face of a different card type is still not modeled"; wave 6 §1.8
  modeled side scheme → ally/environment for the MC32 campaign cards. Pass 1c: that shape (`otherFaceId` both ways,
  the b face its own record) covers a player card front; §1.20.
- **Addition 3, the limit exemption** is card text ("This scheme does not count against the player side scheme
  limit", 40190a–40195a), so it is an ability rule (§3.2), not a data field.
- **No new field for control.** The player who played it controls it (RRG p. 49 above); it sits in the villain's play
  area (`Zone villainArea`), as `play-card.ts` already does.

### 1.2 Assault: no schema change

`{ name: "assault" }` is in `KeywordInstance` and the glossary (`schema/glossary.ts` id `assault`). Printed in this
cycle on Territorial Control (40087, an encounter side scheme) and Keep Them Busy (`x23` 43018, a player side scheme).

### 1.3 Per player icon on a printed cost: `CostedCard.costPerPlayer`

RRG 1.8 "Per Player Icon" (p. 32): "The [per player] icon next to a value multiplies that value by the number of
players who **started** the scenario. If a player is eliminated, this value does not change." MC40 p. 5: "The cost of
these cards is the numeric value multiplied by the number of players who started the scenario" (example: 2[per_hero],
three players, six resources). Ruling Aug 3, 2026 (5): the **printed** cost scales too.

- **Cards.** Team Investigation (40053, 2[per_hero]) and Break Time (`deadpool` 44046, 3[per_hero]). Raw
  `cost_per_hero: true` (`raw-types.ts` declares it; the normalizer drops it: 44046 is emitted today as `cost: 3`).
- **Decision: `CostedCard.costPerPlayer?: true`**, with `cost` holding the printed numeral. Not a `ScalingValue`:
  every existing reader of `cost` takes a number, the icon never comes with a flat part, and a boolean keeps the
  generated data diff to two cards. Validation: not with `specialCost`. The engine reads cost through one function
  (§3.4), so the multiplied number is what "printed cost" means everywhere.
- **Data fix for the data agent:** re-emit 44046 with the flag once the field lands.
- Per player icons inside ability text ("Remove 3[per_hero] threat") are values in the script (`perPlayer`/`scaled`
  `ValueSpec`, existing). Hinder already has `perPlayer` (`hinder` keyword; The Senator's Support 40093, "Hinder
  1[per_hero]").

### 1.4 Alliance: no schema change

`{ name: "alliance" }` exists (wave 4 §3.17). Team Investigation (40053), Flying Formation (`angel` 42031), Break Time
(44046) carry it in raw text; the survey confirms the emitted keyword.

### 1.5 The Marauders: seven villains, two mode faces each, one stage each

MC40 p. 9: "Morlock Siege has seven different villains. Only one villain will be in play at a time, but the order is
randomized … the players must defeat three of these villains." "Flip each villain (A) to its villain (B) side for
expert mode." 40077a Setup: "Shuffle the villains together (without looking) to create the villain deck. The top card
of this deck is in play."

- **The Mansion Attack shape, unchanged** (wave 6 §1.4): each physical card is two one-stage `VillainCard`s, 40070a
  (standard) and 40070b (expert) … 40076a/b; hit points per player (`health_per_hero`). `villainCardId`,
  `setAsideVillainCardIds` (the other six), `expertVillains`, `startingVillain: "random"`, `victory: "cardAbility"`.
  No `multipleVillains`.
- **Not `victoryCondition`:** the count is 3 in every mode and is printed on the main scheme ("If there are 3 villains
  under Routed, the players win the game"), so it is the stage's own state check.
- **Dashed stats:** Blockbuster A and Harpoon A print no SCH in raw (`scheme` absent), Vertigo A no ATK. The data
  agent checks the scans (40071a, 40074a, 40076a) for a printed 0 versus "—"; the Marauders set shows "SCH 0" for
  Blockbuster A in MC40 p. 2's callout, so these are expected to be 0, not dashes.
- **On the Run** uses the same fourteen records: one villain at random, the rest removed from the game (§3.13).

### 1.6 Routed: one environment, two mode-only faces

40081a "Standard Mode Only." / 40081b "Expert Mode Only." One `EnvironmentCard` with a `flipSide`, each face's
`modeOnly` set (`schema/cards/encounter-cards.ts`, wave 4 §3.18, the Standard II / Public Outcry precedent). No change.

### 1.7 Morlock allies: encounter-set allies under a player's control

Morlock (40079, ×4): an ally printed in an encounter set (`morlock_siege`), "Victory -1. Does not count against your
ally limit. Card abilities cannot remove this ally from play." The Captive-ally shape (wave 4 §3.8, wave 6 §3.20 and
§3.71: an `AllyCard` with `cardFamily: "encounter"`, set aside at setup, put into play under a player's control). The
four copies and Hide! (40080) are in `Scenario.setAsideCardIds`. `{ name: "victory", value: -1 }` is valid
(`keywords.ts`: "negative on Snitches Get Stitches").

### 1.8 Hope's Captor: a double-sided permanent attachment

40105a (CONFIDENT) / 40105b (DESPERATE, +1 SCH +1 ATK): one `AttachmentCard` with a `flipSide`, `{ name: "permanent" }`
on both faces, traits per face, no "Attach to" line (the 1A Setup attaches it): `Correction.impliedAttachHost` → the
villain (wave 5 §1.9). The b face's stat box applies only while that face shows (per-face stats, as wave 5 §1.3's
per-face `schemeIcons`; the data agent checks the attachment face type carries `atk`/`sch`).

### 1.9 Conditional attach hosts

| Card                                                    | Printed                                                                                         | Data                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Bolstered by Wrath 40082, Pushed to the Limit 40083     | "Attach to the villain."                                                                        | `{ kind: "villain" }`, existing.                                   |
| Heavy Armament 40090                                    | "Attach to the enemy with the highest ATK."                                                     | The existing `superlative` host (§3.16).                           |
| Titanium Exoskeleton 40091, Hidden in the Clutter 40106 | "Attach to the enemy with the fewest remaining hit points."                                     | As above, measure remaining hit points.                            |
| Inhibitor Collar 40092                                  | "Attach to your identity."                                                                      | `{ kind: "yourIdentity" }`, existing. Stat box ATK −1 (scan read). |
| Favored Weapon 40107                                    | "Attach to Greycrow or Harpoon. Otherwise, attach to the [MARAUDER] enemy with the lowest ATK." | `ifAble` over `anyOf` and a trait-filtered `superlative`: §3.16.   |

### 1.10 Staged villains (pass 1b): the ordinary shape

Juggernaut (40118–40120), Mister Sinister (40136–40138) and Stryfe (40163–40165) are one `VillainCard` of three stages
each, hit points per player, standard stages I and II, expert II and III (MC40 pp. 14, 16, 18), as every staged villain
since the core set. `victory` stays the default (`finalVillainStage`) for all three. No `multipleVillains`.

- **Star stats.** Juggernaut prints ATK 2★ / 3★ / 4★ (the momentum constant); Stryfe prints ATK ★ on every stage.
  Scan 40163 read: Stryfe I prints **"0★"**, not a dash; raw has no `attack` field for it. The data agent emits ATK 0
  with the star (MC40 p. 21 agrees: "his base ATK of 0"). Stryfe II and III print 1★.
- **Counters** are script-named strings on the instance (`momentum` here; `charge` on Samurai 40188). No schema.

### 1.11 Main scheme decks of the three scenarios

| Scenario        | Stages                                                       | Data                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Juggernaut      | 40121, one stage                                             | Scan 40121b read: starting 1 per player, +1 per player, target **7 per player with a star** (it never completes: §3.23). No `completionLoses`.                                          |
| Mister Sinister | 40139 (1), 40140 / 40141 / 40142 (three stage 2s), 40143 (3) | One main scheme deck of five stage records; the three stage 2s are a group of alternatives (same `stageNumber`, different `name`), the Once and Future Kang shape (wave 2 §1.6). §3.28. |
| Stryfe          | 40166 (1), 40167 (2)                                         | Scan 40166b read: starting 0, acceleration "0★", target **9 per player**. Both stages print "If this stage is completed, the players lose the game": `completionLoses: true` on 40166.  |

- **Sinister Intent 1B (40139b)** prints no threat values: `dashedThreatFields: ["startingThreat", "targetThreat",
"acceleration"]` (the `mut_gen` 32125b precedent; the data survey §4.8 asks for the scan check). A dashed target
  never completes (`checkOneMainScheme`, `packages/engine/src/resolve/defeat.ts`); the stage leaves by its own When
  Revealed.
- **No new stage field for "random".** Which stage 2 is removed and the order of the other two are game state
  (`spentMainSchemeStages`, `MainSchemeState.stageOrder`), written by 1B's script (§3.28). The data survey's "may need
  a new `MainSchemeStage` alternative field" is answered: no.
- **Stage 2 values** (40140–40142): 1 starting, +2, target 5, none flagged fixed, so per player; 40143: target 7, +1,
  starting threat flagged fixed with no number; 40167: target 8, +1. The data agent reads 40140b–40143b and 40167b.

### 1.12 The Hope Summers set (40130, 40131)

- **40130 Hope Summers** (scan read): an `AllyCard` with `cardFamily: "encounter"`, set `hope_summers`, unique, cost
  "–" (`specialCost: "dash"`), THW ★ and ATK ★ with **no printed number and no consequential damage pips**, 3 hit
  points, traits PSIONIC, X-FORCE, X-MEN, keyword `{ name: "setup" }`. The stars are values the script defines
  (ruling January 17, 2026 - Ruling 1; RRG "Star Icon", p. 40): data carries 0 with the star flags, the Mystique
  (`mut_gen` 32080) note. Text correction: raw "Hope Summer's", the card prints "Hope Summers's".
- **Not set aside.** The setup keyword puts her into play at Appendix II step 11 (p. 51) in any scenario; the three
  1A Setups that say "Put Hope Summers into play under the first player's control" then find her in play. §3.25.
- **The set is `extraModular: true`** (the field exists; MC40 p. 5: "does not count toward the number of modular
  encounter sets"), listed in `additionalEncounterSetIds` of scenarios 3, 4 and 5 ("required when playing").
- **40131 Captive Hope:** side scheme, 3 starting threat per player (not flagged fixed; MC40 p. 5's callout prints
  "3[per_hero]"), one acceleration icon.
- The basic ally Hope Summers (40204) is a different card: **(pass 2a)**; prohibited in the campaign (§1.19).

### 1.13 Two more double-sided cards

| Card                                   | Faces                                                                                                          | Data                                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40122a/b Juggernaut's Helmet / Exposed | attachment / attachment, `permanent` on both, "Attach to Juggernaut" on both                                   | `flipSide`; the parser accepts the b face's attach line since commit 02c645f5. Host `namedVillain`. No stat box on either face.                                                         |
| 40168a/b Stryfe's Grasp / Living Bomb  | side scheme / side scheme. a: `permanent`, hinder 6 per player, 4 fixed, crisis. b: Victory 1, 3 fixed, crisis | `flipSide` carrying the b face's own `startingThreat`, keywords and scheme icons (per-face icons: wave 5 §1.3). The data agent checks the side scheme face type holds `startingThreat`. |

Same card type on both faces, so the flip keeps tokens, status cards and attachments (RRG "Flip", p. 20). A
double-sided card that would enter a discard pile is removed from the game instead (RRG "Double-Sided Card", p. 17);
Living Bomb's Victory 1 sends it to the victory display, which that entry exempts.

### 1.14 Attach hosts and stat boxes of this pass

| Card                                                           | Printed                                                                                     | Data                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Head of Steam 40123                                            | "When Revealed: Attach Head of Steam to Juggernaut and place 1 momentum counter on him."    | `impliedAttachHost: "ownWhenRevealed"` (no `attachesTo`; ruling Feb 20, 2026 (4), wave 5): a canceled When Revealed must not leave it attached.                        |
| Sinister Disguise 40144                                        | "Attach to Mister Sinister." (raw "Minister")                                               | `namedVillain` after the typo correction.                                                                                                                              |
| Flight 40151, Super Strength 40155, Telepathy 40159            | "Setup. Attach to the villain. Permanent."                                                  | `{ kind: "villain" }`, keywords `setup` and `permanent`, trait SUPERPOWER. Stat boxes: ATK +1, ATK +1, SCH +1 (raw `attack`/`scheme`; the data agent reads the scans). |
| Aerial Bombardment 40152, Out of Reach 40153, Impervious 40156 | "Attach to the villain."                                                                    | `{ kind: "villain" }`.                                                                                                                                                 |
| Thrown Object 40157                                            | "Attach to the villain."                                                                    | `{ kind: "villain" }`, stat box ATK +3.                                                                                                                                |
| Mental Transferal 40169                                        | "If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity." | `impliedAttachHost: "ownWhenRevealed"`: no host shape; the script chooses (§3.35).                                                                                     |
| Mind Alteration 40170, Mind Trap 40171, Psionic Amnesia 40172  | "Attach to your identity." (raw "identify")                                                 | `{ kind: "yourIdentity" }` after the typo correction.                                                                                                                  |
| Psychic Inertia 40173 (×2)                                     | "Attach to your identity."                                                                  | As above. **Scan read: stat box THW −1 and ATK −1.** Raw carries `scheme: -1`; an identity has no SCH, so the correction is `thwart: -1, attack: -1`.                  |

### 1.15 Corrections the data agent owes for these sets

Confirming the data survey §4.6 and adding two: 40154 High Ground is a **treachery** (raw `attachment`); "Minister
Sinister" on 40144 and 40145; "Home Summers" in 40121's Setup; "Samarai" on 40188; "identify" on 40170–40173; "Hope
Summer's" on 40130; **new:** 40173's stat box (§1.14) and 40163's ATK 0★ (§1.10). Creeping Willow (40133) is ×4;
Psychic Override ×2, Telekinetic Wave ×3 and Psychic Inertia ×2 matter to "discard until a PSIONIC attachment".

### 1.16 Scenario records

| Scenario (id)                       | `additionalEncounterSetIds`                             | `recommendedModularSetIds`                | Set aside at setup                                                       |
| ----------------------------------- | ------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Juggernaut (`juggernaut`)           | `hope_summers`                                          | `black_tom_cassidy`                       | 40122a (permanent, so set aside before step 1; RRG p. 32)                |
| Mister Sinister (`mister-sinister`) | `hope_summers`, `flight`, `super_strength`, `telepathy` | `nasty_boys`                              | every card of the three sets (`Scenario.setAsideCardIds`), by 1A's Setup |
| Stryfe (`stryfe`)                   | `hope_summers`                                          | `extreme_measures`, `mutant_insurrection` | 40168a (permanent), revealed by 1A's Setup                               |

Black Tom Cassidy is removable outside the campaign and required in it (MC40 p. 14): a campaign rule, §2.10.
Flight, Super Strength and Telepathy "may be used in other scenarios": ordinary modular sets whose SUPERPOWER
attachment starts in play there through its setup keyword (§3.29, §4.2 Q20).

### 1.17 No schema change for the rest

Every keyword these sets print (assault, guard, hinder, incite, patrol, permanent, quickstrike, setup, surge,
toughness, victory, villainous) is a `KeywordInstance`. "The number of cards of the most common type in your hand" is
a script value (§3.32), not a data field.

### 1.18 Placeholders

- **(pass 2a–2c)** Hero kits, the box's aspect and basic cards, the 'Pool aspect.

### 1.19 The campaign record (`NEXT_EVOL_CAMPAIGN`, pass 1c)

The hand-authored `packages/content/src/data/next_evol/campaign.ts`, the `mut_gen` shape
(`packages/content/src/data/mut_gen/campaign.ts`). **No schema change:** every field below exists on `Campaign`
(`packages/content/src/schema/sets.ts`).

- `id: campaignId("next_evol")`, `boxCode: "MC40"`, `packCode: "next_evol"`, `scenarioIds` in MC40 p. 6's fixed order
  (`morlock-siege`, `on-the-run`, `juggernaut`, `mister-sinister`, `stryfe`), `logSheetReference` to
  `docs/campaign-modes/log-sheets/mc40_next_evolution_campaign_log-compressed.pdf`.
- `campaignSetIds: ["next_evol_campaign"]` (§1.20). Hope Summers, Black Tom Cassidy and every other set of the box
  are **not** campaign-specific (MC40 pp. 5, 14: both "may be used in other scenarios").
- **`prohibited: { cardIds: ["40204"] }`** (MC40 p. 6: "players cannot include the Hope Summers (204) basic ally card
  in their player decks"). The field exists for MC27; `validateDeck` already refuses a prohibited card with
  `campaign_prohibited_card` (`packages/engine/src/deck.ts`), and the deck builder reads `prohibitedCampaignCardIds`.
- No `perSeatSetIds`, no `roles`.
- **Log fields** (MC40 p. 24), for the `CampaignDefinition`; every type is an existing `LogFieldType`
  (`packages/engine/src/campaign.ts`):

| Field (id)                                    | Scope    | Type                        | The sheet's box                                                           |
| --------------------------------------------- | -------- | --------------------------- | ------------------------------------------------------------------------- |
| identity (the seat itself)                    | per seat | the runner's `CampaignSeat` | "Player #N's Identity"                                                    |
| `remainingHp`                                 | per seat | `number`, expert campaign   | "Remaining hit points"                                                    |
| `maraudersDefeated`                           | shared   | `cardList`                  | "Marauders Defeated", lines 1–3                                           |
| `morlocksSaved`                               | shared   | `number` (0–4)              | "Morlocks Saved"                                                          |
| `hopeDamage3`, `hopeDamage4`                  | shared   | `number`                    | "Hope Summers's Damage", "Scenario 3:" and "Scenario 4:"                  |
| `sideSchemes`                                 | shared   | `strikeList`, six options   | a struck option is a row whose "Scenario Chosen" box is filled            |
| `sideSchemeScenario1` … `sideSchemeScenario5` | shared   | `choice` over the same six  | the number written in "Scenario Chosen" (which scheme each scenario used) |
| `encounterCards`                              | shared   | `cardList`                  | the "Encounter Card" of every chosen row, shuffled in from then on        |
| `environmentsEarned`                          | shared   | `cardList` (the b face ids) | "Earned?"                                                                 |

The sheet's fixed pairing (scheme, encounter card, environment) is product data the definition spells out, in the
sheet's own row order: Establish Safehouse 40191a / Vanisher 40201 / Safehouse Established 40191b; Mission Prep 40193a
/ Scrambler 40200 / Mission Prepped 40193b; Assemble the Team 40190a / Malice 40199 / Team Assembled 40190b; Gear Up
40192a / Overburdened 40203 / Geared Up 40192b; Practice Maneuvers 40194a / Lady Mastermind 40198 / Practiced
Maneuvers 40194b; Prepare Defenses 40195a / Under Pressure 40202 / Prepared Defenses 40195b. Six rows, five
scenarios: one scheme is never chosen.

### 1.20 The campaign cards 40190–40203 (set `next_evol_campaign`, 17 cards)

One `EncounterSet` record, `campaignSpecific: true`; every card `specificTo: { kind: "campaign" }` (RRG 1.8
"Campaign-Specific Card", p. 11; MC40 p. 6: "cannot be included in any deck unless playing the NeXt Evolution
campaign and the players are directed to add them to a deck by another campaign card").

| Card                                                   | Type and printed values                                                                                                                                    | Data                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40190a–40195a                                          | player side scheme, unique, cost "–", no resource icons, **4 per player** starting threat (scan 40190a; raw `base_threat: 4`, not flagged fixed), CAMPAIGN | `PlayerSideSchemeCard` with `cost: 0, specialCost: "dash"`, `startingThreat: perPlayerOnly(4)`, `otherFaceId` → its b face. Never in a deck or a hand: only a campaign instruction puts one into play (§3.43).                                |
| 40190b–40195b                                          | environment, no traits                                                                                                                                     | **Its own `EnvironmentCard` record**, built from the a record's nested `linked_card`, `otherFaceId` back to the a face: the `mut_gen` 32171a/b shape (wave 6 §1.8), not `flipSide`, because the type changes. This answers §1.1's Addition 2. |
| 40196 Pouches ×4                                       | resource, two [wild] icons, no text, BASIC / CAMPAIGN (7/17 on the card, MC40 p. 6)                                                                        | `ResourceCard`, basic. Four copies: one per player at most.                                                                                                                                                                                   |
| 40197 Safehouse                                        | support, cost 4, one [wild], LOCATION, BASIC / CAMPAIGN (scan read)                                                                                        | `SupportCard`. Its cost is never paid: Safehouse Established puts it into play.                                                                                                                                                               |
| 40198 Lady Mastermind, 40200 Scrambler, 40201 Vanisher | minions, unique, MARAUDER, SCH 1, ATK 1, 3 hit points, surge; boost icons 2★, 3, 2★                                                                        | Ordinary minions. None shares a title with a Marauders villain.                                                                                                                                                                               |
| 40199 Malice                                           | minion, unique, MARAUDER, SCH 1, ATK 1, **1** hit point, surge, three boost icons (scan read)                                                              | **Text fix:** raw "Threat attached ally"; the card prints "**Treat** attached ally as a [POSSESSED] minion with a blank text box (except for [TRAITS]). Attached minion's SCH is equal to its THW and it does not take consequential damage." |
| 40202 Under Pressure                                   | side scheme, 6 threat fixed, one amplify icon, surge, boost ★ + two icons (scan read)                                                                      | `schemeIcons: ["amplify"]`, `startingThreat: fixed(6)`.                                                                                                                                                                                       |
| 40203 Overburdened                                     | treachery, surge, one boost icon ★                                                                                                                         | —                                                                                                                                                                                                                                             |

- **Flip, not discard.** RRG "Double-Sided Card" (p. 17) removes a double-sided card that would enter a discard pile
  from the game; these never get there (a defeated one flips; an unearned one is removed from the campaign, §2.10).
- **The a face's classification** is "CAMPAIGN (1/17)" with no aspect: the data agent emits whatever `mut_gen`
  171a–175a carry for a campaign card without an aspect, and reports if `PlayerSideSchemeCard` requires one.
- The data agent reads the remaining scans (40190b–40195b, 40191a–40195a, 40196, 40198, 40200, 40201, 40203) against
  the raw text before emitting; this pass read four.

### 1.21 One scenario field the campaign forces: `Scenario.startingVillain: "bySetup"`

MC40 p. 11, scenario 2's first campaign bullet: "**Before resolving the 'Setup' text on Gotta Get Away** (103A), remove
each villain card recorded in the campaign log under 'Marauders Defeated' from the game." Gotta Get Away 1A's Setup
then reads "Put 1 random [MARAUDER] villain into play." Pass 1a gave On the Run `startingVillain: "random"` (§1.5,
§3.13), which `createGame` draws before any campaign window exists (`packages/engine/src/setup.ts`, the first lines
of `createGame`), so the campaign could not narrow the draw.

- **Decision: a second value, `"bySetup"`.** Every villain card of the mode starts set aside and none is in play; the
  main scheme's own Setup puts the starting villain into play (`addVillain`), as its text says. On the Run uses it:
  `villainCardId` plus `setAsideVillainCardIds` still name the seven, and the builder passes
  `GameSetupConfig.villainsStartSetAside`, which today is refused without `villains` ("villainsStartSetAside needs
  villains"); §3.42 lifts that.
- **Not a change to `"random"`:** moving the existing draw later would change the order the seeded RNG is consumed in
  for Loki and Mansion Attack and so break their saved replays. Morlock Siege keeps `"random"` (its villain deck is
  not narrowed by the campaign).
- Validation: `"bySetup"` needs at least one villain card and a stage 1A `setup` ability; not with `multipleVillains`
  (which has its own `atSetup: "setAside"`).

---

## 2. Per-scenario setup needs

RRG 1.8 Appendix II (p. 51) with the wave 1–6 engine. Campaign setup and victory steps are §2.10.

### 2.1 The two scenarios

| Scenario      | Main scheme deck                    | Encounter sets (required) + modulars                                            | 1A Setup / scenario rules                                                                                                                                                                                                 | Needs (§3)                        |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Morlock Siege | Knock, Knock → Mutant Massacre      | Morlock Siege, Standard; Military Grade and Mutant Slayers (both removable)     | "Put the Routed environment into play. Set the Hide! treachery and each Morlock ally aside. Shuffle the villains together (without looking) to create the villain deck. The top card of this deck is in play."            | 3.6–3.12, 3.15                    |
| On the Run    | Gotta Get Away → Escaping with Hope | On the Run, Mutant Slayers, Standard; Military Grade and Nasty Boys (removable) | "Put 1 random [MARAUDER] villain into play. Remove the minion with the same title as the villain, along with each other villain, from the game. Attach the Hope's Captor attachment to the villain, [CONFIDENT] side up." | 3.7, 3.13, 3.14, 3.15, 3.17, 3.18 |

- **Modular sets** (MC40 pp. 9, 11): Military Grade and Mutant Slayers are removable in Morlock Siege; in On the Run
  "the Mutant Slayers set may be used in other scenarios, but it is required" and Military Grade and Nasty Boys are
  removable. `recommendedModularSetIds`: `[military_grade, mutant_slayers]` and `[military_grade, nasty_boys]`.
- **Villain stages.** One stage each; standard is the A face, expert the B face (§1.5). There is no I/II/III.

### 2.2 Morlock Siege (MC40 p. 9)

- **Knock, Knock 1B** (40077b; raw: 1 starting threat, 6 target, +1 per round, none flagged fixed, so per player; the
  data agent reads the scan): "[star] Forced Response: After resolving step one of the villain phase, place 1 knock counter
  here. If there are at least 3 knock counters here, advance to stage 2A. If there are 3 villains under Routed, the
  players win the game."
- **Mutant Massacre 2A** (40078a): "When Revealed: Each player puts 1 set-aside Morlock ally into play under their
  control (2 set-aside Morlock allies instead if this is a single-player game). Shuffle the Hide! treachery into the
  encounter deck. If the previous stage was advanced by knock counters, give each Morlock ally a tough status card."
  Four copies exist, so every player count fits (1 player: 2; 4 players: 4).
- **Mutant Massacre 2B** (40078b; target 8 fixed): "Action: Exhaust a [MORLOCK] ally → shuffle Hide! from the encounter
  discard pile into the encounter deck. If there are 3 villains under Routed, the players win the game. If this stage
  is completed or there are no Morlock allies in play, the players lose the game." Two state checks and the usual
  final-stage loss. The "no Morlock allies" check is on 2B only, so it cannot fire during stage 1.
- **Routed** (40081a/b): "Cards under here are not in play. Forced Response: After the villain is defeated, put it
  under here. Discard each minion that shares a title with the top villain of the villain deck. (That villain is in
  play.) The villain activates against each player in player order." Expert: "The villain gains retaliate 1 for each
  card under here."
  - Order of one defeat, as read: the defeated villain goes under Routed; the win check (3 under Routed) is a state
    check and ends the game there; otherwise the next random villain is in play with its own full hit points, its
    same-title minion is discarded from wherever it is engaged, and it activates against each player in player order
    (attack against a hero, scheme against an alter-ego, a boost card each).
  - MC40 p. 9: "Unlike other scenarios, when one of these villains is defeated, all tokens, status cards, and
    attachments on the just-defeated villain are discarded instead of carrying over." That is RRG 1.8 "Villain Defeat"
    (p. 47) for a new stage of a different title, and what `removeDefeatedVillain` does. An activation the defeated
    villain was making ends (p. 47).
  - A Marauder **minion** cannot enter play while the villain of its title is in play (RRG "Unique Icon", p. 46; all
    fourteen are unique). MC40 p. 21 words the consequence differently: §4.2 Q4.
- **Morlock** (40079): "Forced Interrupt: When an enemy attacks you, it attacks a Morlock you control instead." §3.9,
  §4.2 Q6. The players lose with none in play; a defeated one goes to the victory display (Victory -1).
- **The seven villains** each print "[star] Forced Interrupt: When [name] attacks you or an ally you control, choose:"
  two options; the B faces sharpen one option. §3.11, §4.2 Q8.
- **Side schemes** By Any Means (hazard), In the Midst of Chaos (acceleration), Maraudin' Ain't Easy (amplify),
  Territorial Control (crisis, **assault**): "When Revealed: Place 1[per_hero] additional threat here for each villain
  under Routed."

### 2.3 On the Run (MC40 p. 11)

- **Gotta Get Away 1B** (40103b): "Each [MARAUDER] minion gains steady. When Revealed: Each player searches the
  encounter deck for a [MARAUDER] minion and puts it into play engaged with them. (Shuffle.) If this stage is
  completed, the players lose the game." The printed loss on stage 1 of 2 is literal: completing stage 1 loses; stage
  2 is reached only through Hope's Captor (§3.14). The scenario's main scheme deck therefore needs "completion loses"
  on a non-final stage (§3.15).
- **Escaping with Hope 2A/2B** (40104): "When Revealed: Each player searches the encounter deck and discard pile for a
  [MARAUDER] minion and puts that minion into play engaged with them. (Shuffle.) Give each [MARAUDER] enemy a tough
  status card." 2B: "Each [MARAUDER] minion gains guard and steady. In expert mode, the villain gains steady. If the
  villain is defeated, the players win the game. If this stage is completed, the players lose the game."
- **Hope's Captor** (40105a): "Permanent. [star] Forced Interrupt: When the villain would attack you, if a [MARAUDER]
  minion is engaged with you, the villain schemes instead. Forced Interrupt: When the villain would be defeated, reset
  attached villain's hit points to its printed hit point value instead. Flip this card and reveal it." 40105b: "The
  villain gets +6[per_hero] hit points. When Revealed: Advance the main scheme to stage 2A. This effect cannot be
  canceled." plus the same scheme-instead interrupt. MC40 p. 11: "requires the players to defeat the attached villain
  twice".
- **Winning.** On stage 1 a defeat is replaced (the villain is never defeated), so `victory: "cardAbility"` and the
  2B text wins. If stage 2 were reached with the a face still showing it could not happen: only the flip advances.

### 2.4 The modular sets

| Set            | Cards                                                                                      | Notes                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Military Grade | Heavy Armament, Titanium Exoskeleton, Inhibitor Collar ×2, The Senator's Support           | Inhibitor Collar's Action is the erratum's text (RRG p. 69): "Any player can do this." is rules text. §3.16, §3.19.  |
| Mutant Slayers | Arclight … Vertigo minions (40094–40100), Mutant Slayers side scheme, Bound by Business ×2 | Each minion repeats its villain's choice interrupt. "Each [MARAUDER] minion gains quickstrike." §3.11, §3.8.         |
| Nasty Boys     | Gorgeous George, Hairbag, Ramrod, Ruckus, Slab, Get Nasty                                  | Teamwork (NASTY BOY) on all five (wave 6 §3.1). Slab's growth counters; Hairbag's boost shuffles itself back. §3.20. |

### 2.5 The last three scenarios (pass 1b)

| Scenario        | Main scheme deck                                                               | Encounter sets (required) + modulars                                                               | 1A Setup                                                                                                                           | Needs (§3)                  |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Juggernaut      | The Unstoppable Juggernaut                                                     | Juggernaut, Hope Summers, Standard; Black Tom Cassidy (removable)                                  | "Attach Juggernaut's Helmet to Juggernaut. Put Hope Summers into play under the first player's control."                           | 3.22–3.26, 3.38             |
| Mister Sinister | Sinister Intent → two of Taking Off / Bulking Up / Focusing In → Sinister Ends | Mister Sinister, Flight, Super Strength, Telepathy, Hope Summers, Standard; Nasty Boys (removable) | "Set aside the Flight, Super Strength, and Telepathy encounter sets. Put Hope Summers into play under the first player's control." | 3.25, 3.27–3.31             |
| Stryfe          | Uncontrollable Power → Left to Your Fate                                       | Stryfe, Hope Summers, Standard; Extreme Measures and Mutant Insurrection (removable)               | "Put Hope Summers into play under the first player's control. Reveal Stryfe's Grasp."                                              | 3.25, 3.26, 3.30, 3.32–3.37 |

- **Villain stages:** I and II; II and III in expert (MC40 pp. 14, 16, 18). An expert game's stage II resolves its
  When Revealed during setup, after the main scheme's (RRG Appendix II step 12, p. 51; `resolveScenarioSetup`'s
  order in `packages/engine/src/setup-steps.ts`; MC40 p. 21 for Mister Sinister). §3.37.
- **Hope Summers** is in play in all three and the players lose if she leaves play (§2.9, §3.25).

### 2.6 Juggernaut (MC40 p. 14)

- **Momentum.** Every stage: "[star] Juggernaut gets +1 ATK for each momentum counter here." MC40 p. 14: "When a stage
  of Juggernaut is defeated, all momentum counters on him carry over to the next villain stage", which is RRG
  "Villain Defeat" (p. 47: "Attachments, upgrades, status cards, counters, and non-damage tokens on a villain carry
  over to the new stage"). Sources of counters: Juggernaut I and II's When Revealed, the main scheme's interrupt,
  Juggernaut Exposed's response, Head of Steam, Flatten's choice, Cyttorak's Exemplar. §3.22.
- **Juggernaut I / II / III When Revealed:** I "Place 1 momentum counter here. Give Juggernaut a tough status card."
  II "Place 1 momentum counter here. If Juggernaut Exposed is in play, flip it. Otherwise, give Juggernaut a tough
  status card." III "Search the encounter deck and discard pile for Head of Steam and reveal it. (Shuffle.) If
  Juggernaut Exposed is in play, flip it. Otherwise, give Juggernaut a tough status card."
- **The Unstoppable Juggernaut 1B** (40121b): "[star] Forced Interrupt: When this scheme would be completed, instead
  do each of the following: 1. Remove all threat from here. 2. If Juggernaut Exposed is in play, flip it. 3. Place 1
  momentum counter on Juggernaut. 4. Juggernaut attacks each player in player order (even if they are in alter-ego
  form)." The scheme never completes; the players lose only by elimination or Hope Summers leaving play. §3.23.
- **Juggernaut's Helmet** (40122a): "Permanent. Attach to Juggernaut. Juggernaut gains stalwart and his attacks gain
  overkill. Hero Action: Spend 3 resources of the same type → remove each momentum counter from Juggernaut. Flip this
  card." **Juggernaut Exposed** (40122b): "Permanent. Attach to Juggernaut. Juggernaut takes 1 additional damage from
  each card with a printed [mental] resource. [star] Forced Response: After Juggernaut schemes, place 1 momentum
  counter on Juggernaut. Flip this card." While Exposed shows he has neither stalwart nor overkill. §3.24.
- **Head of Steam** (40123): "Juggernaut gains retaliate X, where X is the number of momentum counters on Juggernaut.
  When Revealed: Attach Head of Steam to Juggernaut and place 1 momentum counter on him. Hero Response: After
  Juggernaut attacks you, spend 1 resource for each damage dealt by that attack → discard this card." §4.2 Q15.
- **The rest of the set:** Building Momentum (side scheme, 3 per player, two acceleration icons), Breakthrough ×2,
  Flatten ×2, Ground Pound ×2, Trample ×2, Cyttorak's Exemplar ×3: all in §3.39's table.
- **Campaign only (§2.10):** a momentum counter per earned environment; Black Tom Cassidy and 1 per player Creeping
  Willow shuffled and dealt one to each player facedown, the rest into the encounter deck (§3.38 has the primitive).

### 2.7 Mister Sinister (MC40 p. 16)

- **Sinister Intent 1A** sets the three sets aside; **1B** (40139b): "When Revealed: Remove 1 random stage 2 from the
  game. Then advance to a random stage 2A." MC40 p. 16: "the order of these stages is randomized and one of the
  stages is removed from the game at random."
- **Each stage 2B** (Taking Off 40140, Bulking Up 40141, Focusing In 40142): "When Revealed: Attach the Flight [Super
  Strength / Telepathy] attachment to Mister Sinister and shuffle the rest of the Flight encounter set into the
  encounter deck. When Completed: Advance to the other stage 2A. If you cannot, advance to stage 3A." So a game sees
  stage 1, two stage 2s in a random order, then stage 3; one set stays set aside for the whole game. §3.28, §3.29.
- **Sinister Ends 3A/3B** (40143): 3A "When Revealed: Deal each player 1 facedown encounter card." 3B "Forced
  Interrupt: When Mister Sinister attacks, he attacks Hope Summers instead. (Other characters may defend the attack.)
  If this stage is completed, the players lose the game." §3.25, §4.2 Q16.
- **Setup order in expert mode** (MC40 p. 21): "The 'When Revealed' effect on Sinister Intent is resolved first. This
  advances the main scheme to a random stage 2, which has both its A and B sides revealed. The 'When Revealed' effect
  on Mister Sinister II is resolved last." So Mister Sinister II counts one SUPERPOWER attachment and places
  2 per player threat on the stage 2 just revealed.
- **Mister Sinister I / II / III:** "Forced Response: After a status card is placed on Mister Sinister, place 1 [2 /
  3] threat on the main scheme." II: "When Revealed: Place 1[per_hero] threat on the main scheme (2[per_hero] threat
  instead if Mister Sinister has fewer than 2 [SUPERPOWER] attachments)"; III prints 2[per_hero] and 3[per_hero].
  §3.27.
- **The SUPERPOWER attachments** (permanent): Flight "Attached villain gains the [AERIAL] trait. [star] Attached
  villain's attacks gain overkill" (+1 ATK); Super Strength "gains the [BRUTE] trait and steady" (+1 ATK); Telepathy
  "gains the [PSIONIC] trait and retaliate 1" (+1 SCH). The set's treacheries read those traits (Genetic Mastery,
  Molecular Control, Sinister Schemes, Sinister Strike, High Ground, "I'll Take That", One Step Ahead).
- **Teleported Away** (40146): "Hinder 1[per_hero]. Mister Sinister cannot take damage. Forced Interrupt: When Mister
  Sinister would attack, he schemes instead." In a standalone game it is an ordinary card of the encounter deck; the
  campaign puts it into play at setup (§2.10). The interrupt is §3.14's replacement (Hope's Captor), and it
  resolves before Sinister Ends can redirect an attack that no longer happens.
- **Sinister Disguise** (40144), **Sinister Soldier** (40145 ×2): §3.31, §3.39.

### 2.8 Stryfe (MC40 p. 18)

- **Most common type.** MC40 p. 18: "count the cards of each different type (ally, event, player side scheme,
  resource, support, and upgrade) in your hand. The type that you have the most of is the most common type. If you
  have more than one type that is tied for the most common, choose one." The number is the same whichever tied type
  is chosen. Read by Stryfe I–III, Uncontrollable Power, Telepathic Camouflage, Psionic Surge; Zero and Telekinetic
  Wave ask for "at least 3 cards of the same type". §3.32, §4.2 Q18.
- **Stryfe I–III:** "[star] While Stryfe is attacking you, he gets +X ATK, where X is the number of cards of the most
  common type in your hand." MC40 p. 21: "a constant ability, so it recalculates every time the contents of your hand
  change, up until the point at which Stryfe deals damage" (the example: a card drawn by Spider-Sense raises it; a
  Backflip played after damage is dealt does not lower it). II: "When Revealed: Each player discards cards from the
  top of the encounter deck until a [PSIONIC] attachment is discarded and reveals that card." III: "Forced Response:
  After you attack Stryfe, take X damage".
- **Uncontrollable Power 1B** (40166b): "[star] Forced Response: After resolving step one of the villain phase, each
  player places X threat here, where X is the number of cards of the most common type in their hand. Each player may
  discard 1 card from their hand before calculating the value of X. If this stage is completed, the players lose the
  game." Its printed acceleration is "0★": this response is the star.
- **Left to Your Fate 2B** (40167b): "Stryfe gains stalwart. Each identity gets +2 hand size. Increase the resource
  cost to play each player card by 1. If this stage is completed, the players lose the game." Stage 2 is reached only
  through Living Bomb.
- **Stryfe's Grasp** (40168a, revealed at setup): "Permanent. Hinder 6[per_hero]. Hope Summers can attack only Stryfe
  and can thwart only this scheme. Forced Response: After Stryfe is defeated or the last threat is removed from this
  scheme, flip this card and reveal Living Bomb. Place any threat here on Living Bomb." **Living Bomb** (40168b):
  "Victory 1. Stryfe cannot be defeated. When Revealed: Advance the main scheme to stage 2A. This effect cannot be
  canceled." §3.34, §4.2 Q19, Q21.
  - The game as read: the players either defeat a stage of Stryfe or empty Stryfe's Grasp (4 + 6 per player threat);
    either flips it. From then Stryfe cannot be defeated until Living Bomb (its 3 threat, plus what was carried) is
    defeated into the victory display, and the main scheme is on stage 2. "After Stryfe is defeated" is any stage's
    defeat (RRG "Villain Defeat", p. 47: "the players have defeated that stage of the villain"); a final stage
    defeated while Stryfe's Grasp shows cannot happen, since the first stage's defeat already flipped it.
- **The PSIONIC attachments:** Mental Transferal (40169) "Forced Response: After Stryfe takes any amount of damage,
  attached character takes an equal amount of damage. Discard this card."; Mind Alteration (40170) "Forced Response:
  After you play an event or upgrade, take 1 damage. Response: After you recover, spend a [mental] resource → discard
  this card."; Mind Trap (40171) "Your allies, upgrades, and supports enter play exhausted. Alter-Ego Action: Exhaust
  3 cards you control → discard this card."; Psionic Amnesia (40172) "Increase the resource cost of each ally and
  support you play by 2. Response: After you play an ally or support, exhaust your identity → discard this card.";
  Psychic Inertia (40173 ×2, THW −1 ATK −1) "Hero Action: If your hero attacked and thwarted this phase → discard
  this card." §3.35, §3.36, §4.2 Q23.
- **Psychic Override** (40178 ×2): "When Revealed: Choose a card type, then discard each card from your hand that is
  not of that type. Draw up to your hand size. Place 1 threat on the main scheme for each card of the chosen type in
  your hand." Ruling January 26, 2026 - Ruling 4 (4): "any card type that exists in Marvel Champions, even if not in
  your hand or deck." §3.33.
- **The rest of the set:** Zero (40174), Cerebral Erasure (40175), Telepathic Camouflage (40176), Psionic Surge
  (40177), Telekinetic Wave (40179 ×3): §3.39. §4.2 Q22 for Zero.

### 2.9 Hope Summers and the six modular sets of this pass

| Set                 | Cards                                                                          | Notes                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hope Summers        | Hope Summers (ally), Captive Hope                                              | "Setup. The first player controls Hope Summers. … does not count against your ally limit. [star] … base THW and base ATK are equal to the THW and ATK of your hero. If Hope Summers leaves play, the players lose the game." §3.25, §4.2 Q14. |
| Black Tom Cassidy   | Black Tom Cassidy, Creeping Willow ×4, Making Green, A Sound Thrashing         | Villainous; "cannot take damage while Creeping Willow is in play"; guard and quickstrike Willows; "Each copy of Creeping Willow gains surge" (a keyword granted to a card being revealed, wave 6 §3.65).                                      |
| Flight              | Flight, Aerial Bombardment, Out of Reach, High Ground ×2                       | §3.29, §3.30, §4.2 Q17. High Ground is a treachery (§1.15).                                                                                                                                                                                   |
| Super Strength      | Super Strength, Impervious, Thrown Object, "I'll Take That" ×2                 | Steady (RRG p. 41): each of the two stunned cards placed is a status card placed (§3.27).                                                                                                                                                     |
| Telepathy           | Telepathy, Manufactured Drama, Sowing Discord (obligations), One Step Ahead ×2 | Two scenario obligations in an encounter set (`encounterSetIds: [telepathy]`, data survey §4.4); retaliate 1 on the villain.                                                                                                                  |
| Extreme Measures    | Strobe, Tempo, Thumbelina, Wildside, Extreme Measures                          | Thumbelina's reduction: §3.30. "After a player card enters play, its controller takes indirect damage equal to that card's printed cost" reads §3.4's `printedCostOf`.                                                                        |
| Mutant Insurrection | Dragoness, Forearm, Reaper, Samurai, Mutant Insurrection                       | Assault (§3.3) on the side scheme; "Each minion gains toughness" (wave 6 §3.65); resource icons counted in hand (`printedResourcesOf`).                                                                                                       |

### 2.10 The campaign (MC40 pp. 6–7, 9, 11, 14, 16, 18, 21, 24; pass 1c)

Five scenarios in numerical order; "Each player must use their chosen identity for the entire campaign, but they are
free to change aspects and alter the contents of their deck between scenarios" (p. 6). A lost scenario may be reset
"with no penalty" (p. 6; foundation row 11 of `docs/campaign-mode-design.md`). The foundation was designed with this
box in view (rows 1, 11, 15, 30, 32, 35, 37, 39, 40, 41, 47, 48, 50, 53, 54, 58, 59). The setup bullets are in printed
order; "choose" is the block every scenario prints, described under the table.

| Scenario          | Campaign setup (in printed order)                                                                                                                                                                                                                                                                                                                                                                                                                                               | Campaign victory                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Morlock Siege   | Record identities ("Players cannot switch identities during a campaign"); choose                                                                                                                                                                                                                                                                                                                                                                                                | Record the title of each villain under Routed ("Marauders Defeated"); record the number of Morlock allies still in play ("Morlocks Saved"); mark earned; expert: record HP |
| 2 On the Run      | **Before 1A's Setup:** remove each recorded villain card from the game ("Minion cards with the same title remain in the encounter deck"); for each Morlock saved, "choose a player to search their deck for one card, add that card to their hand, and shuffle"; if an environment is earned, put it into play "and give each enemy a tough status card"; choose; expert: set HP, heal for an **acceleration token**                                                            | Mark earned; expert: record HP                                                                                                                                             |
| 3 Juggernaut      | Put each earned environment into play; "Place 1 momentum counter on Juggernaut for each campaign environment in play"; shuffle Black Tom Cassidy and 1 per player Creeping Willow together, deal one facedown to each player, shuffle the remaining card into the encounter deck; choose; expert: set HP, heal for **1 facedown encounter card**                                                                                                                                | Record the damage on Hope Summers (`hopeDamage3`); mark earned; expert: record HP                                                                                          |
| 4 Mister Sinister | Earned environments into play; put Teleported Away into play with "an additional 1[per_hero] threat on it for each campaign environment in play"; **choose** to place damage on Hope Summers equal to `hopeDamage3` or that much threat on Teleported Away; choose; expert: set HP, heal for an acceleration token                                                                                                                                                              | Record the damage on Hope Summers (`hopeDamage4`); mark earned; expert: record HP                                                                                          |
| 5 Stryfe          | Earned environments into play; 1 per player threat on Stryfe's Grasp for each; **choose** damage on Hope Summers equal to `hopeDamage4` or that much threat on Stryfe's Grasp; in player order each player discards from the encounter deck "until they discard a minion or a Psionic attachment" and reveals it; shuffle the encounter discard pile into the encounter deck; choose; expert: set HP, heal for 1 facedown encounter card; **expert: a loss loses the campaign** | "Stryfe is defeated and the players win the campaign!"                                                                                                                     |

- **"Choose"** (every scenario; scenarios 2–5 add "that has not been chosen previously"): "The players as a group
  choose 1 player side scheme listed in the campaign log", put it into play, mark it as chosen for this scenario, and
  "take each encounter card that corresponds to a player side scheme marked as chosen in the campaign log and shuffle
  them into the encounter deck" (scenario 1: the one card). So the encounter cards accumulate: one in scenario 1, five
  in scenario 5, "even if the players do not defeat the player side scheme" (p. 7). "The players may look at both
  sides of all of the cards in the campaign set" when choosing (p. 7).
- **Earning** (p. 7). Defeating the scheme flips it to its environment, which the players "earn … for the current
  scenario and all future scenarios". It is recorded only by the **Victory** step ("Mark each campaign environment in
  play as 'Earned'"), so a lost game earns nothing. "If the players do not defeat the chosen player side scheme by the
  time they win the scenario, that card is removed from the campaign and cannot be chosen again."
- **Retry** (p. 7): "When the players replay a scenario after losing, they must choose the same player side scheme for
  that scenario and defeat it in order to earn its reward, even if they defeated it during a game they lost." §3.40.
- **How scenario 1 changes scenario 2.** The three villains under Routed are out of scenario 2's random draw (four
  remain; both mode faces of a recorded title go, §3.42), and each Morlock saved (0–4) is one deck search. The search
  resolves in the default campaign window, before starting hands are drawn (§4.2 Q28).
- **Hope Summers's damage** carries from scenario 3 to 4 and from 4 to 5, and each time the players may turn it into
  threat instead (foundation row 59). It is "place", not "deal": a tough status card is not spent and nothing
  triggers on damage dealt (`placeDamage`). She has 3 hit points and leaving play loses the game, so a recorded value
  is 0–2 unless something raised her hit points; with 0 recorded there is no choice to make.
- **Scenario 3's facedown cards.** One Black Tom Cassidy and 1 per player Creeping Willow (four copies exist) are
  taken from the encounter deck, so players + 1 cards for players seats: every player gets one and exactly one goes
  back. Black Tom Cassidy is therefore **required** in the campaign's Juggernaut (p. 14,
  `docs/campaign-modes/markdown/mc40_next_evolution.md`: "The Black Tom Cassidy set can be removed from this scenario
  and/or added to other scenarios when using the scenario customization rules, but it is required when playing
  Juggernaut in campaign mode"), and the client does not offer to swap it out (§5.2).
  - **How the definition says so:** `CampaignNode.requiredModularSetIds: ["black_tom_cassidy"]` on the scenario 3 node,
    plain data. It is not a `composeEncounterSets` op: that adds a set's cards beside whatever the builder shuffled
    in, and Black Tom Cassidy is already Juggernaut's recommended set, so composing it would put the set in twice.
  - **How a game start reads it:** `startGameFromLog` returns `requiredModularSetIds` (empty for every other node);
    the builder passes `campaignModularSetIds(start, recommended, picked)` as the scenario's modular sets; and the
    list is frozen into `CampaignGameInput.requiredModularSetIds`, where `createGame` refuses (`invalid_setup`) a game
    in which no card of a required set exists.
  - **When the caller also picks sets:** required sets are added to the pick, never replaced by it, and a set named
    twice is in the game once. With nothing picked, the scenario's recommendation is used.
  - **The count:** a required set is one of the scenario's modular sets, not an extra one. Juggernaut prints "One
    modular encounter set (Black Tom Cassidy)" (40121a Contents, MC40 p. 14), so in the campaign that one slot is
    taken and the default is exactly that set. `campaignModularSetIds` does not trim: a different pick for Juggernaut
    comes back as two sets, which the wave builders accept and the app's entry point (`playableScenario`'s exact-count
    check) refuses. A picker offers the scenario's count minus the required sets (none here).
- **Scenario 5 in expert mode** resolves Stryfe II's own When Revealed first (scenario setup: each player ends with a
  PSIONIC attachment, §3.37), then this block's discard-until-reveal for every player.
- **Prohibited card:** Hope Summers 40204 (§1.19). **Campaign cards** 190–203 enter a game only by instruction.
- **Expert campaign** (p. 7). Persistent damage: after a win "each player must record their remaining hit points",
  capped at the base value (foundation row 18); the next setup sets hit points to it and offers the scenario's heal.
  "If a player is defeated during a scenario that their teammates go on to win, the defeated player does not
  participate in the Victory steps of that scenario" and "can rejoin their teammates for the next scenario by
  following that scenario's setup instructions for healing their identity to its full hit points": a defeated player
  must pay the heal (wave 6 §4.1 Q11, carried; the token in scenarios 2 and 4, the facedown card in 3 and 5). §3.46.
- **Campaign FAQ** (p. 21). Three entries bear on campaign games: the Marauders minion entry (§4.2 Q4; a recorded
  villain's minion stays in scenario 2's deck and can enter play, since that villain is out of the game); the
  expert-mode order of Sinister Intent and Mister Sinister II (§2.7), which the campaign's Teleported Away follows,
  not precedes (campaign setup is after scenario setup); and Stryfe's recalculated attack (§2.8). None is specific to
  campaign mode, and none conflicts with the Campaign Instructions.
- **The definition** is `packages/cards/src/campaigns/next_evol.ts`, the `mut_gen.ts` shape: `graph: { kind:
"linear" }`, `loss: { retry: "byInstruction", retryBaseline: "nodeStart" }` with scenario 5's expert `defeat`
  instruction (`endCampaign lost`, as `mut_gen.ts`'s last node), `elimination` as `mut_gen.ts`'s.

---

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by behavior (2026-10-04) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`trigger-events.ts`, `actions.ts`, `rules.ts`, `resolve/*`), the DSL in `packages/cards/src/dsl` and the wave 1–6
specs. **"exists (verify)"** means the primitive was found by name and doc comment and its behavior for this card was
not run: the scripting agent proves it in a test before relying on it, and a failure becomes a partial here. Each
section is one agent, one commit.

| §    | Primitive                                                                  | Needed by                                                                   | Status           |
| ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------- |
| 3.1  | A player side scheme in play                                               | 40006, 40018–40020, 40027, 40054, 40059; 41016, 42017, 43018 …              | partial          |
| 3.2  | The player side scheme limit                                               | every player side scheme; 40190a–40195a's exemption                         | missing          |
| 3.3  | Assault                                                                    | Territorial Control 40087, Keep Them Busy 43018                             | partial          |
| 3.4  | A per player printed cost                                                  | Team Investigation 40053, Break Time 44046                                  | missing          |
| 3.5  | Alliance                                                                   | 40053, 42031, 44046                                                         | exists           |
| 3.6  | A villain deck of different titles, one in play                            | Morlock Siege                                                               | exists (verify)  |
| 3.7  | A defeated villain placed under a card, and counted there                  | Routed 40081; 40077b, 40078b, 40082–40089                                   | partial          |
| 3.8  | "Shares a title with" as a query                                           | Routed, Bound by Business 40102, Gotta Get Away 1A                          | partial          |
| 3.9  | An enemy attack redirected to an ally its target controls                  | Morlock 40079                                                               | exists (verify)  |
| 3.10 | "Card abilities cannot remove this ally from play"                         | Morlock 40079                                                               | partial          |
| 3.11 | An encounter card's "choose" between two effects on an attack              | 40070–40076 a/b, 40094–40100                                                | exists (compose) |
| 3.12 | What advanced the main scheme                                              | Mutant Massacre 2A                                                          | partial          |
| 3.13 | Setup: one random villain, the rest removed from the game                  | Gotta Get Away 1A                                                           | partial          |
| 3.14 | An enemy activation replaced by the other kind; a defeat replaced          | Hope's Captor 40105a/b                                                      | exists (verify)  |
| 3.15 | A non-final main scheme stage whose completion loses                       | Gotta Get Away 1B                                                           | exists           |
| 3.16 | Superlative and fallback attach hosts for enemies                          | 40090, 40091, 40106, 40107                                                  | exists (verify)  |
| 3.17 | Damage placed on an attachment instead; who dealt it                       | Hidden in the Clutter 40106                                                 | exists (verify)  |
| 3.18 | "After your hero defends … and takes no damage"                            | Favored Weapon 40107                                                        | exists (verify)  |
| 3.19 | An identity's text box blanked except traits; an enemy attack as a cost    | Inhibitor Collar 40092; Pushed to the Limit 40083                           | partial          |
| 3.20 | A boost card that shuffles itself into the encounter deck                  | Hairbag 40113                                                               | exists (verify)  |
| 3.21 | Reusable as is                                                             | —                                                                           | checked          |
| 3.22 | Counters on a villain that carry between stages and set a stat             | Juggernaut 40118–40120, 40122a/b, 40123, 40126, 40129                       | exists (verify)  |
| 3.23 | A completion replaced by numbered steps; an attack on every player         | The Unstoppable Juggernaut 40121b                                           | exists (verify)  |
| 3.24 | A permanent attachment other cards flip back and forth                     | Juggernaut's Helmet / Exposed 40122a/b                                      | exists (verify)  |
| 3.25 | An ally the first player controls, with its hero's stats, that must stay   | Hope Summers 40130; Sinister Ends 40143b; Captive Hope 40131                | partial          |
| 3.26 | A character limited to one attack target and one scheme                    | Stryfe's Grasp 40168a                                                       | exists (verify)  |
| 3.27 | "After a status card is placed on X"                                       | Mister Sinister 40136–40138                                                 | missing          |
| 3.28 | Alternative main scheme stages: one removed at random, the rest ordered    | Sinister Intent 40139b; 40140–40142                                         | partial          |
| 3.29 | A named set-aside set: one card attached, the rest shuffled in             | 40140b–40142b; Flight 40151, Super Strength 40155, Telepathy 40159          | exists (verify)  |
| 3.30 | Damage rules that read the attacker or the attack's keywords               | Out of Reach 40153, Aerial Bombardment 40152, Thumbelina 40182              | partial          |
| 3.31 | A player's damage sent elsewhere unless they pay                           | Sinister Disguise 40144                                                     | exists (verify)  |
| 3.32 | "The number of cards of the most common type in your hand"                 | 40163–40166, 40174, 40176, 40177, 40179                                     | missing          |
| 3.33 | "Choose a card type"                                                       | Psychic Override 40178                                                      | partial          |
| 3.34 | A permanent side scheme that flips at no threat or on a stage's defeat     | Stryfe's Grasp / Living Bomb 40168a/b                                       | partial          |
| 3.35 | An attach host decided by a condition at reveal                            | Mental Transferal 40169                                                     | partial          |
| 3.36 | Cards that enter play exhausted; "attacked and thwarted this phase"        | Mind Trap 40171, Psychic Inertia 40173                                      | partial          |
| 3.37 | A villain stage's When Revealed during setup                               | Stryfe II 40164, Mister Sinister II 40137, Juggernaut II 40119              | exists (verify)  |
| 3.38 | Named encounter cards dealt facedown                                       | Psionic Surge 40177; Black Tom and Creeping Willow (§3.45)                  | exists (verify)  |
| 3.39 | Reusable as is (pass 1b)                                                   | —                                                                           | checked          |
| 3.40 | A campaign choice a retry must repeat                                      | the campaign's chosen player side scheme (MC40 p. 7)                        | partial          |
| 3.41 | Damage on a card, read out of the finished game                            | Hope Summers 40130 (Victory, scenarios 3 and 4)                             | missing          |
| 3.42 | The starting villain put into play by the main scheme's Setup              | Gotta Get Away 1A in the campaign                                           | partial          |
| 3.43 | A campaign player side scheme put into play, flipping to an environment    | 40190a/b–40195a/b                                                           | partial          |
| 3.44 | A minion that stays in play attached to an ally it treats as a minion      | Malice 40199; 'Pool-ized 44041 (pass 2c)                                    | partial          |
| 3.45 | Cards the campaign log carries into each game                              | 40190b–40195b, 40196, 40197, 40198–40203                                    | exists (verify)  |
| 3.46 | The expert campaign: persistent damage, elimination, rejoining             | all five scenarios                                                          | exists (compose) |
| 3.47 | "A printed cost of N or more" as a query                                   | Practiced Maneuvers 40194b                                                  | missing          |
| 3.48 | Reusable as is (pass 1c)                                                   | —                                                                           | checked          |
| 3.49 | The victory display as a place cards are taken from and sent to            | Forced Amnesia 40010, Temporal Leap 40013, Technovirus Resurgence 40031     | missing          |
| 3.50 | A constant ability that works from the victory display                     | Technovirus Purge 40006                                                     | missing          |
| 3.51 | "Characters other than X cannot remove threat from here"                   | Technovirus Purge 40006                                                     | partial          |
| 3.52 | "After [identity] defeats a side scheme"                                   | Cable 40001a                                                                | exists (verify)  |
| 3.53 | An obligation that puts a player side scheme into play and attaches to it  | Technovirus Resurgence 40031                                                | partial          |
| 3.54 | "When the main scheme would be completed" on a player card                 | Temporal Leap 40013                                                         | exists (verify)  |
| 3.55 | A player-deck discard as an event the discarded card can answer            | Jackpot! 40043, Digging Deep 40060, White Fox 40057, The Painted Lady 40045 | missing          |
| 3.56 | Resource icons on cards discarded from a deck; an icon counted twice       | Domino 40037a; 40038–40042, 40046, 40049, 40050, 40064                      | partial          |
| 3.57 | Swapping a hand card with the top of the deck or discard pile              | Domino / Neena Thurman 40037a/b                                             | exists (verify)  |
| 3.58 | Facedown cards attached to a support, to a maximum                         | The Painted Lady 40045                                                      | exists (verify)  |
| 3.59 | "When you make a ranged attack"                                            | Sharpshooter 40064                                                          | missing          |
| 3.60 | An enemy that cancels events as they are played; bans scoped to one player | Stryfe 40032, Back to the Future 40033                                      | exists (verify)  |
| 3.61 | Reusable as is (pass 2a)                                                   | —                                                                           | checked          |
| 3.62 | A three-face identity whose hero faces differ only by title                | Angel 42001a/b/c, Metamorphosis 42005, Apocalyptic Influence 42024          | partial          |
| 3.63 | A scheme icon printed on one identity face, or on an obligation in play    | Archangel 42001c, Apocalyptic Influence 42024                               | partial          |
| 3.64 | A double-sided permanent upgrade its controller flips                      | Psi-Knife / Psi-Katana 41002a/b, Psylocke 41001a/b, Body Swapped 41025      | partial          |
| 3.65 | "The number of [type] resources on cards you control"                      | Chimera 41026, Telekinetic Dragon 41029                                     | exists (verify)  |
| 3.66 | A player's attack redirected to a friendly character                       | Psionic Illusion 41028                                                      | missing          |
| 3.67 | An attack whose boost icons and Boost abilities are ignored                | Aerial Agility 42004                                                        | missing          |
| 3.68 | A played event returned to hand after it resolves                          | Avian Anatomy 42008                                                         | partial          |
| 3.69 | "An attack that has a keyword"; "Max 1 per attack"                         | Directed Force 41019                                                        | missing          |
| 3.70 | An obligation that stays in play until its own Action discards it          | Body Swapped 41025, Apocalyptic Influence 42024                             | exists (verify)  |
| 3.71 | An either-trait identity play restriction                                  | Elixir 42011                                                                | exists (compose) |
| 3.72 | Reusable as is (pass 2b)                                                   | —                                                                           | checked          |
| 3.73 | 'Pool as a deck's chosen aspect                                            | every 'Pool card; the Deadpool precon                                       | exists           |
| 3.74 | An encounter set included only when a player chose an aspect               | Crisis of Infinite Deadpools 44037 and the `dreadpool` set                  | missing          |
| 3.75 | Linked cards set aside at setup                                            | Specialized Training 43021; 43034–43037                                     | partial          |
| 3.76 | Acceleration tokens on the main scheme as a number                         | 44002, 44003, 44007, 44011                                                  | partial          |
| 3.77 | The four encounter icons counted across every card in play                 | 44017, 44019, 44021, 44023, 44052, 44055; the icons printed on 'Pool cards  | partial          |
| 3.78 | A player's defeat replaced                                                 | Deadpool 44001a, Git Gud 44028                                              | exists (verify)  |
| 3.79 | A damage cost whose amount the payer chooses                               | Maximum Effort 44004, "Yoo-Hoo!" 44006                                      | missing          |
| 3.80 | A resource card whose yield is computed                                    | Montage 44007; 44025–44027                                                  | partial          |
| 3.81 | "Search your collection"                                                   | Armed to the Teeth 44009                                                    | missing          |
| 3.82 | "Counts as 2 restricted cards"                                             | Laser Swords 44055                                                          | missing          |
| 3.83 | Facts from outside the game                                                | Git Gud 44028, Break Time 44046, The Merc with the Mouth 44032              | missing          |
| 3.84 | Marked spaces on a card                                                    | Blackout 44053, Tic-Tac-Toe 44057                                           | exists (compose) |
| 3.85 | "After X takes any amount of damage" when the damage defeated X            | X-23 43001a, Honey Badger 43003                                             | exists (verify)  |
| 3.86 | An obligation that holds a card facedown under it                          | Self-Isolation 43028                                                        | exists (verify)  |
| 3.87 | Reusable as is (pass 2c)                                                   | —                                                                           | checked          |

### 3.1 A player side scheme in play

> **Status: partial.** Built since wave 1 and never exercised by a scripted card: `executePlayCardFrame`
> (`packages/engine/src/resolve/play-card.ts`) moves a played `player_side_scheme` to `villainArea`, sets the playing
> player as controller and places `scale(startingThreat, startingPlayerCount)`; `select.ts` gives it the categories
> `sideScheme` and `scheme`; `resolve/event.ts` defeats it at 0 threat through `schemeDefeated` (interrupts first, then
> When Defeated, then leaving play); Victory X sends it to the victory display (`docs/phase7-wave3.md` line 305, `discardFromPlay
{ defeated: true }`); `unique.ts` treats it as entering play; `reveal.ts` refuses to reveal one; `legal.ts` and
> `actions.ts` accept it as a basic thwart target. Gaps below.

**Cards.** `next_evol` 40006, 40018, 40019, 40020, 40027, 40054, 40059; `psylocke` 41016; `angel` 42017; `x23` 43018,
43021, 43039; `deadpool` 44024; campaign 40190a–40195a (§3.43).

**Rules.** RRG 1.8 "Player Side Scheme" (p. 34), "Scheme (Card Type)" (p. 39: "three different card types: main
schemes, player side schemes, and side schemes"), "Player Turn" (p. 34: "**Play** an ally, upgrade, support, or
player side scheme card from hand"), p. 49 (not an extension of the identity). MC40 p. 3: "A player can only play a
player side scheme during their turn."

**Gaps, each small.**

1. **Scheme icons** on a player side scheme: `showingIconsOn` returns `[]`; read `BaseCard.schemeIcons` (§1.1).
2. **Discard destination** when it leaves play undefeated (the limit, §3.2): its owner's discard pile, no When
   Defeated, no victory display. `discardFromPlay` without `defeated` should already do this; a test pins it.
3. **"The player who defeated this scheme"** (41016, 43018): `defeatingPlayer` exists and is handed to When Defeated
   (`event.ts`, "Crossbones' Assault"); when an encounter effect or no player removed the last threat, the When
   Defeated has no such player: resolve with the scheme's controller (§4.2 Q2).
4. **Encounter text that names side schemes** counts player side schemes (p. 34: "Any rules or card effects that refer
   to 'schemes' or 'side schemes' also refer to player side schemes"): Riptide's "1 threat on each side scheme" places
   threat on them; "for each side scheme in play" counts them; crisis and hazard icons do not exist on them unless
   printed. Already so through the shared `sideScheme` category; one test per direction.
5. **An eliminated player's player side scheme** leaves play with the rest of their cards (RRG "Player Elimination").
   Verify the elimination sweep covers `villainArea` cards by owner.

**Plan.** No new vocabulary: fix gap 1, add `player-side-scheme.test.ts` covering play on your turn only, per-player
starting threat, thwart by hero and ally, removal by "a side scheme" events, defeat order (ruling Aug 3, 2026 (1)),
Victory 0 to the victory display, gaps 2–5. Log events are the existing `cardPlayed`, `threatPlaced`,
`schemeDefeated`.

**Composes with:** every later player side scheme (`bp`, `jubilee`, `magneto`, `iceman`, `ncrawler`, `silk`, `jj`
61029), which the data already carries.

### 3.2 The player side scheme limit

> **Status: missing.** No reference to a scheme limit anywhere in `packages/engine/src` or `packages/cards/src`
> (searched "schemeLimit", "side scheme limit"). The ally limit is the model: `checkAllyLimit`
> (`resolve/enter-play.ts`) and `RuleSpec allyLimit` / `excludedFromAllyLimit` (`abilities.ts`).

**Rules.** RRG 1.8 "Player Side Scheme Limit" (p. 34): "If one or two players started the game, the player side
scheme limit is one. If three or four players started the game, the limit is two. If there are ever more player side
schemes in play than the limit, the first player chooses and discards player side schemes until there are no longer
more in play than the limit. A player may play a player side scheme even while at the player side scheme limit. If
they do, they must choose a player side scheme to discard. (The player side scheme discarded this way is not
considered defeated.)" MC40 p. 21 (Technovirus Resurgence puts Technovirus Purge into play at the limit): "The first
player chooses one player side scheme in play to discard, which could include Technovirus Purge."

**Plan.**

- `playerSideSchemeLimit(state)`: 1 for a `startingPlayerCount` of 1–2, 2 for 3–4. A game-wide limit, not per player.
- **`checkPlayerSideSchemeLimit(ctx, chooser)`** in `enterPlay`, beside `checkAllyLimit`, before "enters play"
  abilities: counts player side schemes in play that no `excludedFromPlayerSideSchemeLimit` rule covers; over the
  limit, the chooser picks one to discard (a `choice` frame), repeated until at the limit. Chooser: the playing player
  when the scheme was **played**; the first player when an effect put it into play or the limit dropped (§4.2 Q1 on
  whether the new scheme may be chosen).
- **`RuleSpec excludedFromPlayerSideSchemeLimit { target }`**, the sibling of `excludedFromAllyLimit`, for
  40190a–40195a.
- The discard is `discardFromPlay` without `defeated`: owner's discard pile, `cardLeavesPlay`, no When Defeated. Log
  `playerSideSchemeLimitDiscard { instanceId, chosenBy }`.
- `legalActions` offers the play at the limit; `why-not.ts` needs no entry.

**Composes with:** every pack's player side schemes; Professor (40008) only searches for one.

### 3.3 Assault

> **Status: partial.** `basicThwart` (`packages/engine/src/actions.ts` ~line 3729) uses ATK when the scheme has the
> keyword (`hasKeyword(…, "assault")`, so a granted assault counts) and refuses a character with a printed "—" ATK;
> `select.ts` ~line 1732 picks the consequential-damage stat from the thwart event's `useAtk`. Test:
> `primitives-wave2.test.ts` "the Assault keyword thwarts with ATK". Two things are not covered.

**Cards.** Territorial Control (40087), Keep Them Busy (`x23` 43018).

**Rules.** RRG 1.8 "Assault" (p. 8): "When a character makes a basic thwart against a scheme with the assault
keyword, that character uses its ATK instead of its THW", equivalent to "While a character is making a basic thwart
against this scheme, that character uses its ATK instead of its THW." "If the thwarting character is an ally, it
takes the consequential damage listed under its ATK instead of its THW after the thwart." "Abilities that increase a
character's 'basic power' can be used to increase that character's ATK when that character thwarts a scheme with
assault." MC40 p. 4 agrees.

**Gaps.**

1. **A divided basic thwart** (`command.divide`, `RuleSpec divideBasicPower`): the code sets `assault = !command.divide
&& …`, so a divided thwart that includes an assault scheme uses THW. The RRG has no carve-out. §4.2 Q3.
2. **Untested:** an ally's consequential damage under assault (the ATK number), "+N to your next basic thwart"
   bonuses (`nextBasicPower`, wave 6 §3.39) applying to the ATK used, THW-only modifiers not applying, a confused
   thwarter (the status card still replaces it), "after you use a basic power"/`basicPowerUsed` reporting a thwart.
   It is still a thwart, not an attack: no retaliate, no "after you attack".

**Plan.** Tests for gap 2 in `assault.test.ts`; gap 1 per the answer to Q3.

### 3.4 A per player printed cost

> **Status: missing.** `CostedCard.cost` is a number and the normalizer drops raw `cost_per_hero`. The engine has
> `scale(value, startingPlayerCount)` for `ScalingValue`s (threat, hit points) and `ValueSpec perPlayer`/`scaled` for
> ability text; nothing scales a card's own cost.

**Cards.** Team Investigation (40053), Break Time (`deadpool` 44046).

**Rules.** RRG 1.8 "Per Player Icon" (p. 32); MC40 p. 5; ruling Aug 3, 2026 (5): "Printed cost scales with player
count: In a 2-player game, printed cost is **4**, dealing 4 damage with Echo's Katana"; RRG "Printed" (p. 35).

**Plan.** `CostedCard.costPerPlayer` (§1.3) and **one reader**, `printedCostOf(state, card)` = `cost ×
startingPlayerCount` when the flag is set. Every existing reader of `card.cost` goes through it: the price of a play
(`actions.ts` pricing), cost reducers' floors, `ValueSpec printedCost` and `totalPrintedCost`, queries that filter by
cost ("with a printed cost of 3 or less"), superlatives ("highest-cost card you control", Greycrow), "ignoring its
resource cost". The audit of readers is the work; grep `\.cost\b` in `packages/engine/src`. Eliminated players do not
change it. Out of a game (deck building, the client's card inspector) the card shows "2 per player".

**Composes with:** alliance (§3.5): the group pays the multiplied cost.

### 3.5 Alliance

> **Status: exists.** Wave 4 §3.17: `paidAsGroup` and the group payment paths in `packages/engine/src/actions.ts`
> (hand cards and resource abilities of any player, `resourcesSpent` per spender in `trigger-events.ts`), tests in
> `alliance.test.ts`, whose header already names Team Investigation as a plain resource cost.

RRG 1.8 "Alliance" (p. 6): "any player(s) may help pay the costs for that card … Only the player playing the card
with the alliance keyword is considered to be resolving that card." Nothing to build. One new test once §3.4 lands:
a 2[per_hero] alliance card in a three-player game is paid by three hands.

### 3.6 A villain deck of different titles, one in play

> **Status: exists (verify).** Wave 6 §3.21 (Mansion Attack): `Scenario.startingVillain: "random"`,
> `setAsideVillainCardIds`, `expertVillains`, `victory: "cardAbility"`; `defeatVillainStage` and
> `removeDefeatedVillain` (`resolve/defeat.ts`) take a defeated last stage out of play with its attachments, boost
> cards and tucked cards discarded; `addVillain` with `reveal`; `encounterSetAside { random }` on the seeded RNG; zero
> villains in play is legal (`set-aside-villains.test.ts`).

Differences from Mansion Attack to verify in a scenario test: seven villains; no Victory X on the villain (so it does
not go to the victory display: §3.7 says where it goes); the next villain activates against **each** player
(`forEachPlayer` around `enemyActivation`); expert Routed's "retaliate 1 for each card under here" as a constant with a
`refCount` value.

### 3.7 A defeated villain placed under a card, and counted there

> **Status: partial.** `tuckCards`, `TargetRef tuckedUnder`, the `tucked` selector and `ValueSpec refCount`/`countInRef`
> exist (Kang's Dominion, Operation Zero Tolerance, Med Lab), and tucked cards are out of play. But a defeated villain
> without Victory X is only flagged `defeated: true` and removed (`defeatVillainStage`); nothing lets card text send it
> somewhere. `RuleSpec defeatDestination` / `EffectSpec setDefeatDestination` cover a side scheme, an ally or a minion.

**Cards.** Routed (40081a/b): "After the villain is defeated, put it under here." Counted by 40077b, 40078b, 40082,
40083, 40084–40087, 40088, 40089, 40081b.

**Plan.** Extend the defeat-destination vocabulary to a villain's last stage: `defeatDestination { to: { tuckedUnder:
TargetRef } }` (or `tuckCards` accepting the just-defeated villain from a response to `characterDefeated`), so the
villain's instance ends in the host's `tucked` list, faceup, out of play. Then "villains under Routed" is
`refCount(tuckedUnder(self), { categories: ["villain"] })`, and the win is a `stateCheck`. Prefer the response form:
Routed prints a Forced Response, and the same response then discards the title-sharing minion and activates the new
villain, in printed order. Log `cardTucked { instanceId, underInstanceId }` (existing).

**Composes with:** the campaign's "Record the title of each villain under Routed" (§2.10) reads the same list
(`CampaignGameQuery cardsTuckedUnder`).

### 3.8 "Shares a title with" as a query

> **Status: partial.** Titles are compared by the uniqueness rule (`unique.ts` `matchingCardInPlay`, `titles.ts`) and a
> fixed name is `TargetQuery named`. Mansion Attack's script enumerates its four titles
> (`packages/cards/src/wave6/mut_gen/mansion-attack.ts`, `TITLES.map(sameTitleMinionDealtWith)`). No query compares a
> candidate's title with another card's.

**Cards.** Routed ("each minion that shares a title with the top villain"), Bound by Business (40102: "a [MARAUDER]
minion that does not share a title with a card in play"), Gotta Get Away 1A ("the minion with the same title as the
villain").

**Plan.** `TargetQuery sharesTitleWith: TargetRef` (true when the candidate's title equals the title of any card the
ref names), usable under `not`. Seven-title enumeration in the script would work today; the query is the reusable
form and removes a per-scenario list. Titles only (RRG "Unique Icon" p. 45 matching also reads subtitles; these cards
say "title").

**Composes with:** Mansion Attack (re-point), the Sinister Six namesakes (`campaign-primitives.test.ts`).

### 3.9 An enemy attack redirected to an ally its target controls

> **Status: exists (verify).** `EffectSpec retargetAttack { character }` (wave 4 §3.21, Crossfire): from an interrupt
> to the innermost `enemyAttack`, before a defender is declared; the new target's controller is the attacked player;
> "when it attacks" does not trigger again.

**Card.** Morlock (40079): "Forced Interrupt: When an enemy attacks you, it attacks a Morlock you control instead."

Script: `interrupt(on.enemyAttack(you), retargetAttack(chosen Morlock you control))`, forced. To verify: several
Morlocks (the controller chooses); the attack still may be defended by the hero or another ally (RRG p. 10); overkill
from a defeated Morlock goes to the controller's identity (p. 10); the Marauder's own "attacks you or an ally you
control" interrupt triggers once, whichever resolves first. §4.2 Q5, Q6.

### 3.10 "Card abilities cannot remove this ally from play"

> **Status: partial.** `RuleSpec cannotLeavePlay` is absolute (RRG "'Cannot'", p. 11, "like the permanent keyword") and
> would also stop a defeat by damage, which the scenario needs ("no Morlock allies in play, the players lose").

**Plan.** `cannotLeavePlay` gains `by?: "cardAbilities"`: discards, returns to hand or deck, removals and "defeat"
effects resolved from a card ability do nothing to the card; reaching 0 hit points still defeats it, whatever dealt
the damage. Player elimination still removes it. §4.2 Q7 on where damage from an ability falls.

### 3.11 An encounter card's "choose" between two effects on an attack

> **Status: exists (compose).** `chooseOne`, `on.enemyAttack` interrupts keyed on the attacked player (RRG p. 10: an
> attack on an ally you control attacks you), and each option's effect: `giveStatus` confused/stunned/tough,
> `modifyAttack` (+2 ATK for this attack), `spendResources`, `discardFromPlay` with `superlative` over `printedCost`,
> `dealIndirectDamage`, `placeThreat` on the main scheme and each side scheme, `grantKeywordUntil`/`attackKeywords`
> (overkill, ranged, piercing), and an additional boost card for the activation in progress (`spec.ts` ~lines 484,
> 1317, 1353: "give him an additional boost card for this activation").

**Cards.** Villains 40070a/b–40076a/b; minions 40094–40100 (Harpoon the minion: "+2 ATK … gains piercing" instead of a
boost card).

**To verify while scripting:** the B faces' forced targets ("the character you control with the highest THW/ATK":
`superlative`, ties to the player); Greycrow B "discard each card you control with the highest cost" (`ties: "all"`);
X read after the choice; a stalwart or already-confused target. Which options may be chosen when one cannot be
carried out: §4.2 Q8.

### 3.12 What advanced the main scheme

> **Status: partial.** `TriggerEvent mainSchemeAdvanced { stageIndex, schemeInstanceId? }` carries no cause, and
> `advanceMainScheme` records none.

**Card.** Mutant Massacre 2A: "If the previous stage was advanced by knock counters, give each Morlock ally a tough
status card."

**Plan.** `advanceMainScheme` and the completion path stamp `MainSchemeState.advancedBy: { cause: "completed" |
"cardEffect"; sourceInstanceId: InstanceId | null }`, copied onto `mainSchemeAdvanced` and the log event. A predicate
`mainSchemeAdvancedBy { cause, source?: TargetRef }` reads it; 2A asks for `cardEffect` from the scheme itself. Until
it lands the script could set a `setVar` before advancing, but the cause belongs in the log either way.

**Composes with:** Hope's Captor's advance (§3.14) and any later "if this stage was advanced by" text.

### 3.13 Setup: one random villain, the rest removed from the game

> **Status: partial.** `startingVillain: "random"` picks one and sets the others aside; `removeVillain` and
> `GameState.removedFromGame` exist; a `setup` ability can move cards. Removing the set-aside villains and one minion
> from a built encounter deck at setup has no test.

**Card.** Gotta Get Away 1A. Campaign: "**Before** resolving the 'Setup' text … remove each villain card recorded in
the campaign log under 'Marauders Defeated' from the game" (MC40 p. 11). **Pass 1c:** that sentence cannot be met by
`startingVillain: "random"`, which draws in `createGame`; On the Run uses `"bySetup"` instead (§1.21, §3.42), and the
plan below then starts with "put one random set-aside villain into play".

**Plan.** Script on 1A's `setup`: remove from the game every set-aside villain and the minion that
`sharesTitleWith(theVillain)` (§3.8), wherever it is (the encounter deck; Mutant Slayers is required, so it is
present), then attach the set-aside Hope's Captor a face. If a removal effect over set-aside villains does not exist
as an effect, add `removeFromGame { target }` taking out-of-play refs (the `removedFromGame` selector already reads
the area).

### 3.14 An enemy activation replaced by the other kind; a defeat replaced

> **Status: exists (verify).** `TriggerEvent enemyActivating`/`enemyAttack` interrupts with `replaceTriggeringEvent`
> (RRG "Replacement Effect", p. 37; "'Instead'", p. 25) and `enemyScheme`/`enemyActivation`; a `defeat` interrupt with
> `replaceTriggeringEvent` + `setRemainingHitPoints` (Captain America's Helmet, wave 1 §3.13) which announces
> `hitPointsReset` at maximum (wave 6 §3.67); `flipCard` with the full reveal of the new face (`flipToOtherFace`,
> wave 6 §4.1 Q36 for villains; attachments reveal as encounter cards); `RuleSpec cannotBeCanceled`;
> `advanceMainScheme { to }`; a hit point modifier on a dial character (RRG "Hit Points", p. 22: "increase that
> character's hit point dial by X").

**Card.** Hope's Captor (40105a/b).

**To verify.** (a) The replaced attack becomes a scheme against the same player with one boost card, and "after the
villain attacks" does not fire. (b) The defeat replacement works for a **villain's** defeat (the Helmet's is an
identity's): the stage is not removed, attachments and status cards stay, excess damage is lost, `characterDefeated`
is not announced. (c) Order on the flip: hit points reset to the printed value, flip, the b face's +6 per player
raises the dial, then its When Revealed advances the scheme. (d) Permanent keeps both faces attached (RRG p. 32).
§4.2 Q9, Q10.

### 3.15 A non-final main scheme stage whose completion loses

> **Status: exists.** `MainSchemeStage.completionLoses` (`packages/content/src/schema/cards/schemes.ts`; wave 3 §3.37),
> read by `completionLoses` in `packages/engine/src/resolve/defeat.ts`: completing a stage that carries it loses the
> game whatever stages follow. Its doc comment already names Gotta Get Away 1B (40103b) and Uncontrollable Power 1B
> (40166b). Pass 1a missed the field and proposed a `whenCompleted` script; pass 1b found it (§3.39, first row).

**Data, not a script:** `completionLoses: true` on 40103b (and on 40104b, where it restates the final-stage rule). No
ability is written for the sentence. One thing left to pin in the scenario test: `advanceMainScheme { to: 2 }` from
Hope's Captor is an advance, not a completion, so it does not lose.

### 3.16 Superlative and fallback attach hosts for enemies

> **Status: exists (verify).** Pass 1a missed the host kinds that already cover this
> (`packages/content/src/schema/cards/attachment-host.ts`, resolved in `packages/engine/src/resolve/reveal.ts`):
> **`{ kind: "superlative"; among; order; measure } & HostQualifiers`** with `among: "enemy"` (`SuperlativeHostPool`),
> `measure: "atk"` or `"remainingHp"` (`HostMeasure`) and `order: "highest" | "lowest"`; **`ifAble { preferred,
otherwise }`** for "Otherwise, attach to …"; **`anyOf`** for "Greycrow or Harpoon" (`namedCard` each). The parser
> emits them, and since commit 02c645f5 a leading trait word ("the [MARAUDER] enemy with the lowest ATK") becomes the
> superlative host's `trait` qualifier. No new host kind and no `superlativeEnemy` / `firstOf`.

| Card                                                    | Host                                                                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Heavy Armament 40090                                    | `superlative { among: "enemy", order: "highest", measure: "atk" }`                                                                                                 |
| Titanium Exoskeleton 40091, Hidden in the Clutter 40106 | `superlative { among: "enemy", order: "lowest", measure: "remainingHp" }`                                                                                          |
| Favored Weapon 40107                                    | `ifAble { preferred: anyOf [namedCard Greycrow, namedCard Harpoon], otherwise: superlative { among: "enemy", order: "lowest", measure: "atk", trait: MARAUDER } }` |

**To verify** (the data agent on the emitted records, then one engine test): `measure: "atk"` reads the current ATK
with modifiers, not the printed one; `remainingHp` on a villain reads its dial; a tie is the first player's choice
(RRG "First Player", p. 19); `namedCard` matches Greycrow or Harpoon as a villain or as a minion.

### 3.17 Damage placed on an attachment instead; who dealt it

> **Status: exists (verify).** `replaceTriggeringEvent` on a `dealDamage` interrupt with `placeDamage` on another card
> ("place it here instead"; `damage-on-environment.test.ts`, `damage-to-counters.test.ts`), `eventSource` and
> `controllerOf` for the dealing player, `enemyAttack` against a chosen player, `then`.

**Card.** Hidden in the Clutter (40106): "When any amount of damage would be dealt to attached enemy, place it here
instead. If there is at least 3 damage here, attached enemy attacks the player who dealt the damage just placed here.
Then, discard this card." Verify: tough on the host is not spent (the damage is never dealt to it); damage with no
dealing player triggers no attack (§4.2 Q11).

### 3.18 "After your hero defends … and takes no damage"

> **Status: exists (verify).** `TriggerEvent defended` and `eventDamageTakenAtLeast` exist (Unflappable's shape, core
> Protection).

Favored Weapon (40107): response with a `→` cost-free discard, hero defender only, attacker is the host. Its "[star]
Attached enemy's attacks gain overkill, piercing, and ranged" is `attackKeywords`.

### 3.19 An identity's text box blanked except traits; an enemy attack as a cost

> **Status: partial.** `RuleSpec blankTextBox` (constant, a class of cards; `blank-text-box.test.ts`) with
> `exceptKeywords`, and `keepPrintedTraits` on treat-as rules (`spec.ts` ~line 1234). Blanking an **identity** (both
> faces, its form-specific abilities, keywords such as a hero's printed retaliate) is untested. `triggerableBy` (wave 6
> §3.11) and either-costs (`either-cost.test.ts`) exist. No cost kind makes an enemy attack.

**Cards.** Inhibitor Collar (40092; erratum RRG p. 69): "Treat your identity's printed text box as if it were blank
(except for traits). Action: Choose to either exhaust a character you control or take 3 damage → discard this card.
Any player can do this." Pushed to the Limit (40083): "Hero Action: Attached villain attacks you → discard this card."

**Plan.** (a) `blankTextBox { target: host identity }` from the attachment, traits kept (they are outside what the
rule removes; confirm), covering whichever face is up; hand size, hit points and the stat line are not text box.
Setup-time and "limit once per game" memory is untouched. §4.2 Q12. (b) **`AbilityCost enemyAttack { enemy, against:
"you" }`**: the cost is paid by the attack being initiated and resolved in full (boost card, defense, damage); the
effect resolves after it, if the ability's card is still in play. A cost, so it cannot be canceled into a free
effect: if the attack cannot be initiated (the villain is stunned: the stun is discarded and no attack is made), the
cost is not paid (§4.2 Q13).

### 3.20 A boost card that shuffles itself into the encounter deck

> **Status: exists (verify).** `atEndOfActivation` (wave 2), `moveCards` to the encounter deck with shuffle, and `self`
> for the boost card being resolved.

Hairbag (40113): "[star] Boost: After this activation, shuffle Hairbag into the encounter deck." Verify the boost
card is not also discarded at the activation's end, and that a boost card dealt to a minion (villainous) behaves alike.

### 3.21 Reusable as is (checked against the engine unions)

| Card text                                                                                                                    | Existing vocabulary                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "After resolving step one of the villain phase, place 1 knock counter here" (40077b)                                         | `villainStepResolved { step: "placeThreat" }` (wave 3 §3.2), `addCounters`, `counterAtLeast`, `advanceMainScheme { to }` |
| "Each player puts 1 set-aside Morlock ally into play under their control (2 … single-player)"                                | `forEachPlayer`, `encounterSetAside`, `putIntoPlay` (wave 6 §3.20/§3.71), `excludedFromAllyLimit`                        |
| "If … there are no Morlock allies in play, the players lose" / "3 villains under Routed … win"                               | `stateCheck`, `endGame`, §3.7's count                                                                                    |
| "Exhaust a [MORLOCK] ally → shuffle Hide! from the encounter discard pile into the encounter deck"                           | exhaust cost, `moveCards`, `shuffleEncounterDeck`                                                                        |
| Hide! (40080): tough to a Morlock; boost: tough and "1 additional boost card for this activation"                            | `giveStatus`, the additional boost card effect (`spec.ts` ~line 1317)                                                    |
| "Standard Mode Only." / "Expert Mode Only." (40081a/b)                                                                       | `modeOnly` (wave 4 §3.18); verify on an environment                                                                      |
| "The villain gains retaliate 1 for each card under here" / "gains steady" / "gains stalwart" (40081b, 40083)                 | constant keyword grants with a `while` and a value (the Master Mold "gains guard" shape)                                 |
| "This card gets +X boost icons" (40082)                                                                                      | `boostIconsCounting` + `adjustBoostCount` (wave 2 §3.6)                                                                  |
| "Exhaust a character you control and spend X resources of any type" (40082)                                                  | combined costs with a `ValueSpec` amount                                                                                 |
| "Place 1[per_hero] additional threat here for each villain under Routed" (40084–40087)                                       | `placeThreat` with `product(perPlayer, refCount)`                                                                        |
| "When Revealed (Alter-Ego) … / (Hero): The villain attacks you … gains overkill" (40089)                                     | form-split When Revealed (core Assault), `enemyAttack` with granted keywords (`enemy-attack-granted-overkill.test.ts`)   |
| "Each [MARAUDER] minion gains steady / guard / quickstrike"; "In expert mode, the villain gains steady"                      | constant keyword grants; `inMode` (wave 5 §3.11)                                                                         |
| "Each player searches the encounter deck (and discard pile) for a [MARAUDER] minion and puts it into play engaged with them" | `forEachPlayer`, `find`/search, `putIntoPlay` engaged, shuffle                                                           |
| "Give each [MARAUDER] enemy a tough status card" (40104a)                                                                    | `giveStatus` over a query                                                                                                |
| "While Blockbuster is in play, this scheme gains the crisis icon" (40109)                                                    | `gainsIcon` with `while exists(named)`                                                                                   |
| Bushwhack (40108): "The player who defeated this scheme searches …"                                                          | `defeatingPlayer`                                                                                                        |
| Tag Team (40111): engaged Marauder minions activate; discard 7, topmost Marauder minion into play                            | `enemyActivation` over a query; `discardEncounterCards`, topmost selector (`encounter-topmost-only.test.ts`)             |
| Heavy Armament (40090): retaliate 2; "After you attack the attached enemy, spend 2 resources of the same type → discard"     | keyword grant; same-type resource cost (wave 3 §3.43)                                                                    |
| Titanium Exoskeleton (40091): "cannot take more than 2 damage from a single attack"; either spend 3 or remove a status card  | `maxDamageTakenPerAttack` (wave 3 §3.15); either-cost; status removal as a cost (wave 6 §3.6; verify on an enemy)        |
| The Senator's Support (40093): "Hinder 1[per_hero]"; discard until an attachment, reveal it                                  | `hinder.perPlayer`; `discardEncounterUntil` + `revealCard`                                                               |
| Mutant Slayers (40101): 1 threat per character with any of four traits                                                       | `count` with an `or` of `hasTrait`                                                                                       |
| Nasty Boys: Teamwork (NASTY BOY)                                                                                             | wave 6 §3.1 (`teamworkFrame`, `resolve/enter-play.ts`); decisions Q1, Q2                                                 |
| Slab (40116): growth counters, "+1 ATK for each … for this attack"                                                           | `addCounters`, `modifyAttack` with `counters`                                                                            |
| Ruckus (40115): "Stun each character you control"; boost "You are stunned"                                                   | `giveStatus` over a query                                                                                                |
| Get Nasty (40117): "Each minion gets +1 ATK"; threat per minion; search and reveal                                           | constant modifier; `placeThreat` with a sum; search + `revealCard`                                                       |
| Dizzying Deeds (40110): exhaust; extra effects per named enemy in play                                                       | `conditional` on `exists(named)`                                                                                         |

### 3.22 Counters on a villain that carry between stages and set a stat

> **Status: exists (verify).** Counters are named strings on a `CardInstance` (`addCounters`, `removeAllCounters`:
> `packages/cards/src/dsl/remove-all-counters.test.ts`, `ValueSpec counters`); `defeatVillainStage`
> (`packages/engine/src/resolve/defeat.ts`) keeps the villain's instance across stages and resets only `damage`, so
> counters, status cards and attachments stay (RRG "Villain Defeat", p. 47). A constant stat modifier takes a
> `ValueSpec` amount (`StatModifierSpec.amount`), and `KeywordGrantSpec.value` already cites this card: "Juggernaut
> gains retaliate X, where X is the number of momentum counters on Juggernaut" (`abilities.ts`, wave 4 §3.53).

**Cards.** Juggernaut I–III, the Helmet's action, Juggernaut Exposed, Head of Steam, Flatten (40126), Cyttorak's
Exemplar (40129); "damage equal to Juggernaut's ATK" on Breakthrough, Flatten, Ground Pound, Cyttorak's Exemplar reads
the modified ATK (`ValueSpec stat`).

**To verify.** A stage defeated with counters on it: the next stage shows them and its own When Revealed adds one;
RRG "All-Purpose Counter" (p. 6) makes them tokens, so nothing else moves them. Retaliate 0 grants nothing after the
Helmet's action empties them. The log shows `countersPlaced` / `countersRemoved` with the counter's name.

### 3.23 A completion replaced by numbered steps; an attack on every player

> **Status: exists (verify).** `TriggerEvent mainSchemeCompleting` with a replacing interrupt (wave 4 §3.4, Under
> Siege: "remove all the threat from this stage instead"; `applyMainSchemeCompleting`, `resolve/defeat.ts`),
> `removeThreat` all, `flipCard` under `exists(named)`, `addCounters`, `forEachPlayer` in player order around
> `enemyAttack { against }` (`spec.ts`: "attacks each player in `against`"). An attack an effect causes does not check
> form: "(even if they are in alter-ego form)" is reminder text.

**To verify.** The four steps resolve in printed order and each in full before the next ("do each of the following");
threat placed above the target in one step (acceleration, a scheme activation) triggers it once; each attack has its
own boost card and its own defense; a stunned Juggernaut is impossible while the Helmet shows (stalwart) and loses one
attack while Exposed shows; a player eliminated by an earlier attack is skipped; Hope Summers defeated by one of the
attacks ends the game there.

### 3.24 A permanent attachment other cards flip back and forth

> **Status: exists (verify).** `EffectSpec flipCard` on a `flipSide` encounter card (`spec.ts`: "A double-sided
> encounter card turns to its other face"; `rules.ts` reads the showing face), same card type so everything on it
> stays (RRG "Flip", p. 20); `Predicate exists` over `named` matches the showing face's title; `increaseDamageTaken {
fromSource: { printedResource: "mental" } }` is the Troll's rule word for word (wave 6 §3.68); same-type resource
> costs (wave 3 §3.43); `attackKeywords` and constant keyword grants.

**To verify.** Each face's constants apply only while it shows (stalwart and overkill on the a face; the extra damage
on the b face); gaining stalwart on the flip back removes stunned and confused cards (RRG "Stalwart", p. 40);
permanent holds on both faces (RRG p. 32: only cards "in the same set" may make it leave play; the flippers are the
`juggernaut` set's own cards and flipping is not leaving play); neither face has a When Revealed, so the flip reveals
nothing. "Exposed is in play, flip it. Otherwise, give … tough" is `conditional` on the showing face.

### 3.25 An ally the first player controls, with its hero's stats, that must stay in play

> **Status: partial.** Found: `RuleSpec controlledByFirstPlayer` (wave 3 §3.13; `first-player-control.test.ts`
> covers a support, the Milano), `excludedFromAllyLimit`, `StatModifierSpec.setBase` with a `ValueSpec` amount (the
> Ultron Drones' base stats), `TriggerEvent cardLeavesPlay` answered by the card that left (`leftCardCandidates`,
> wave 5 §3.13), `endGame`, `retargetAttack` (§3.9), `cannotReady` (`rules.ts`), an encounter-set ally under a
> player's control (wave 4 §3.8, `captive-ally.test.ts`). Not found: any of these exercised on an **ally**, and a
> setup-keyword ally entering play from the encounter deck under a player's control (`putSetupCardsIntoPlay` calls
> `enterPlayOnReveal`, written for encounter cards).

**Cards.** Hope Summers (40130); Sinister Ends 3B (40143b); Captive Hope (40131); every 1A Setup of §2.5.

**Rules.** RRG "First Player" (p. 19), "Ally Limit" (p. 7), "Star Icon" (p. 40), "Leaves Play" (p. 27), "Attacks
Against Allies" (p. 10), MC40 p. 5. Ruling January 17, 2026 - Ruling 1: (1) "the value of a star icon is defined by
its associated ability"; (2) the "Leaves Play" bullets are "**not an interrupt ability**; … carried out simultaneously
with the card leaving play".

**Plan.**

1. **Entering play.** Step 11 puts a setup-keyword ally found in the encounter deck into play under the first
   player's control, ready, without an ally limit check that could discard her (she is excluded from the count; she
   still occupies no slot). The 1A Setup's "Put Hope Summers into play" is then `putIntoPlay` guarded by "if not in
   play", which also covers a game where a campaign step moved her.
2. **Control follows the token** (`controlledByFirstPlayer`): she moves as she is, exhausted or not, with her damage,
   status cards and attachments; it is not leaving or entering play. Verify with an ally, with a first player
   eliminated, and with Captive Hope's "cannot ready" in force.
3. **Base THW and ATK** are two `setBase` modifiers whose amounts read her controller's hero (§4.2 Q14 for alter-ego
   form). Modifiers on Hope herself add on top; consequential damage is 0 (§1.12).
4. **"If Hope Summers leaves play, the players lose the game."** A response on `cardLeavesPlay` for self with
   `endGame("lose")`, forced, not cancelable, from every way of leaving (defeat, discard, return to hand, removed).
   The log reason is a new `LossReason` value, `requiredCardLeftPlay`, carrying the card. If her defeat and the last
   villain stage's defeat come from one effect, the order is the engine's defeat order; a test pins it.
5. **Sinister Ends:** `interrupt(on.enemyAttack(by villain), retargetAttack(named Hope Summers))`, forced. Verify the
   attack may still be defended by any hero or ally (the card's reminder; RRG p. 10), that undefended damage lands on
   her 3 hit points, and that overkill from Flight spills to her controller.

**Composes with:** Morlock's redirect (§3.9; a Morlock is not in these scenarios), 1a's Q5 and Q6.

### 3.26 A character limited to one attack target and one scheme

> **Status: exists (verify).** `RuleSpec cannotAttack { target, attacker }` (wave 3 §3.26, "Drax cannot attack
> minions": restricts the character, not its controller) and `cannotThwart { thwarter, schemes }` (wave 6 §3.77).

Stryfe's Grasp (40168a): "Hope Summers can attack only Stryfe and can thwart only this scheme" is both rules with a
negated query (every enemy but the one named Stryfe; every scheme but self). Verify it binds events that make an ally
attack or thwart, and that it ends with the flip (Living Bomb does not print it).

### 3.27 "After a status card is placed on X"

> **Status: missing.** `TriggerEvent statusDiscarded` exists (wave 6 §3.5) and the log has `statusGiven`
> (`abilities.ts`, the `keepsGivingStatus` doc), but no trigger event announces a status card being placed
> (`trigger-events.ts` searched for "status").

**Cards.** Mister Sinister I–III: "Forced Response: After a status card is placed on Mister Sinister, place 1 / 2 / 3
threat on the main scheme."

**Rules.** RRG "Status Cards" (p. 41): "When a character is given a status card, take a status card of the specified
type from the pool and place it on that character. A character cannot have more than one status card of each type";
steady allows a second stunned and a second confused.

**Plan.** `TriggerEvent statusPlaced { instanceId, status, sourceInstanceId, playerId? }`, the mirror of
`statusDiscarded`: response only, one per status card that actually lands, pushed only when an ability listens. A give
that the character cannot hold (it already has one, stalwart, `cannotHaveStatus`) places nothing and announces
nothing. Every path announces it: `giveStatus` from an effect, the toughness keyword on entering play or on a new
stage, a constant's refill (`keepsGivingStatus`). Encounter effects count: Molecular Control's tough costs the players
threat as well. The DSL gets `on.statusPlaced(target, { status? })`.

**Composes with:** any later "after X is stunned / confused / given a tough status card" response.

### 3.28 Alternative main scheme stages: one removed at random, the rest in a random order

> **Status: partial.** Found: stages that share a `stageNumber` are a group of alternatives (`nextMainSchemeStage`
> returns `"alternatives"`; `advanceMainScheme { to: { stageNumber, name } }`, wave 2 §3.4); `GameState
.spentMainSchemeStages`; `EffectSpec shuffleMainSchemeStages { fromStageIndex }` and `MainSchemeState.stageOrder`,
> which the default advance walks (wave 6 §3.18); `removeMainSchemeStage` (a separate game area's stage only: "The
> central stage cannot be removed"). Not found: removing a stage of the **central** scheme's deck that is not the
> current one, picking it at random, and shuffling only one stage number's group (`shuffleMainSchemeStages` shuffles
> everything from an index on, which would put stage 3 among the stage 2s).

**Cards.** Sinister Intent 1B (40139b); Taking Off, Bulking Up, Focusing In (40140–40142).

**Plan.**

- **`EffectSpec removeMainSchemeStages { stageNumber, random: ValueSpec, bind? }`**: that many unspent stages with the
  number, not the current one, chosen with the seeded RNG, are marked spent and logged `mainSchemeStageRemoved {
stageIndex }`. The A sides are faceup in a physical main scheme deck, so which stage went is public.
- **`shuffleMainSchemeStages` gains `stageNumber?`**: only that group is ordered; later stages keep their place
  behind it. The stored order leaves out spent stages.
- **1B's script:** remove 1 random stage 2, shuffle the stage 2 group, `advanceMainScheme` (the default walk). The
  result is stage 1 → 2x → 2y → 3.
- **The stage 2Bs' "When Completed: Advance to the other stage 2A. If you cannot, advance to stage 3A"** is exactly
  the default walk over that order and is **not scripted as an effect**: `completeMainScheme` (`resolve/defeat.ts`)
  resolves a stage's When Completed abilities and then pushes its own `advanceMainScheme`, so a scripted advance would
  move two stages. Same handling as the Brotherhood's stage 2Bs (wave 6 §3.19: "prints no advance of its own to
  script"). The card's ability ref stays in data for display.
- **Setup order** (MC40 p. 21): 1B's When Revealed runs in Appendix II step 12 before the villain's; the advance's
  frames (the new stage's A side, its B side's When Revealed, its starting threat) are pushed above the villain's
  When Revealed frames, so they resolve first. A test pins it for expert mode: Mister Sinister II sees one SUPERPOWER
  attachment and its threat lands on the stage 2.

**Composes with:** the Brotherhood Strikes! (wave 6 §3.18) and Kang's stage 3 group.

### 3.29 A named set-aside set: one card attached, the rest shuffled in

> **Status: exists (verify).** `CardSelector encounterSetAside { filter }` with `TargetQuery.inEncounterSet`
> (`spec.ts`), `attach` from the set-aside area (Hope's Captor, §3.13), `moveCards` to the encounter deck with a
> shuffle. `shuffleInSetAsideModularSet` (wave 4 §3.18, wave 6 §3.62) picks its set at **random** and reveals rather
> than attaches, so it is not the tool here.

**Cards.** The stage 2Bs' When Revealed; in other scenarios the three SUPERPOWER attachments enter play by their
setup keyword and their own "Attach to the villain".

**To verify.** The attachment is attached, not revealed (no "when revealed" windows; it has no When Revealed); the
rest of the set, obligations included (Telepathy's two), joins the encounter deck and the deck is shuffled once;
the third set never leaves the set-aside area; the granted trait is read by the set's treacheries
(`traitGrants`, `abilities.ts`); steady and retaliate 1 are constant keyword grants; the stat boxes apply. In
scenario 4 the setup keyword must not put the three attachments into play (§4.2 Q20): `putSetupCardsIntoPlay` reads
encounter decks and players' permanent set-aside cards, never `encounterSetAside`, so today it does not.

### 3.30 Damage rules that read the attacker or the attack's keywords

> **Status: partial.** Found: `cannotTakeDamage { fromSource, exceptFromSource }` on the damage's source card
> (`damageSourceCard`, wave 6 §3.68, §4 Q39), `reduceDamageTaken { fromAttack }` (wave 3 §3.15),
> `characterIgnores { ignores: ("guard" | "patrol" | "crisis")[] }` (wave 4 §3.24) with `TriggerEvent keywordIgnored`,
> `doubleDamageTaken.attackKeyword` (wave 6 §3.68). Not found: an exception keyed on the **attacker** when the damage
> comes through another card, an exception keyed on the attack's keyword, and retaliate among the ignorable keywords.

**Cards and gaps.**

1. **Out of Reach** (40153): "The villain cannot take damage unless the attacker or attack has the [AERIAL] trait, or
   the attack has ranged." `exceptFromSource` sees the event for an event's attack, so an AERIAL hero playing a
   non-AERIAL attack event would be blocked. Add **`exceptAttacker?: TargetQuery`** (the attacking character, as
   `cannotAttack.attacker` reads it) and **`exceptAttackKeyword?: AttackKeyword`** (the attack's keywords, the
   attacker's or granted: `attackKeywordsOf`). §4.2 Q17 for damage that is not an attack.
2. **Thumbelina** (40182): "Reduce the amount of damage Thumbelina takes from each attack by 1 unless the attacker has
   the [TINY] trait." `reduceDamageTaken` gains the same `exceptAttacker`.
3. **Aerial Bombardment** (40152): "[star] Attached villain gets +1 ATK and ignores the retaliate keyword while
   attacking a non-[AERIAL] character." `characterIgnores.ignores` gains `"retaliate"` with **`against?:
TargetQuery`** (the attacked character); the +1 ATK is a stat modifier `while` the same condition holds. RRG
   "Ignore" (p. 23).

**Thumbelina and excess damage.** Excess is measured on damage taken (`excessDamageOf`, `resolve/event.ts`; RRG
"Overkill", p. 31; user decision 2026-09-25, which set aside February 8, 2026 - Ruling 2). August 3, 2026 - Ruling 6
defines "exactly defeat" by excess **dealt**; no card in this cycle prints it, so it is noted, not built (§0).

### 3.31 A player's damage sent elsewhere unless they pay

> **Status: exists (verify).** A `dealDamage` interrupt with an optional payment and a redirect of the triggering
> damage (Robert Kelly's "deal that damage to Robert Kelly instead", `spec.ts` ~line 1165), `superlative` over
> remaining hit points with ties to the player, `then`.

Sinister Disguise (40144): "Forced Interrupt: When a player would deal damage to Mister Sinister, that player may
spend [mental][mental] resources. If they do not, they deal that damage to the friendly character with the fewest
remaining hit points instead. Discard this card (whether the resources were spent or not)." Verify: "a player" is the
damage event's player (an ally's attack is its controller's); damage with no player does not trigger it; the
redirected damage keeps its amount and its attack context (an ally's consequential damage still applies); Hope
Summers is a friendly character and is often the lowest.

### 3.32 "The number of cards of the most common type in your hand"

> **Status: missing.** `ValueSpec handSize` counts a hand, optionally filtered (`spec.ts` ~line 780); nothing groups
> a hand by card type and takes the largest group (searched "mostCommon", "groupBy", "sameType", "cardType").

**Cards.** Stryfe I–III, Uncontrollable Power 1B, Telepathic Camouflage (40176), Psionic Surge (40177); as a
threshold: Zero (40174: "at least 3 cards of the same type in their hand"), Telekinetic Wave's boost (40179: "at
least 3 cards in your hand that share a type").

**Rules.** MC40 p. 18 ("Most Common Type") and p. 21 (the value is constant and recalculates "up until the point at
which Stryfe deals damage").

**Plan.** **`ValueSpec largestHandTypeGroup { player }`**: the size of the largest group of cards in that player's
hand sharing a card type (0 for an empty hand). The tie-break "choose one" never changes the number, so no choice is
asked. Both thresholds are this value at least 3.

- **Stryfe's ATK** is a constant modifier with that amount, `while` he is the attacker of the current attack and
  `you` is the attacked player (`attackingEnemy`, `activating-enemy.test.ts`). Attack damage is computed when it is
  dealt, so a card drawn or played before that changes it and one played after does not (MC40 p. 21's example is the
  test). §4.2 Q5 decides whether it applies when the attack is against an ally.
- **Uncontrollable Power:** in player order each player may discard one card, then places their own X; the threat is
  placed by that player's instance of the response, so "each player" keeps who placed what in the log.
- **What counts as a type:** §4.2 Q18.

### 3.33 "Choose a card type"

> **Status: partial.** `chooseOne` offers printed options and `TargetQuery.categories` filters by card type; a
> fifteen-branch `chooseOne` would work today. No effect binds a chosen card type for later steps to read.

**Card.** Psychic Override (40178). Ruling January 26, 2026 - Ruling 4 (4): "You can choose **any card type** that
exists in Marvel Champions, even if not in your hand or deck." RRG "Card Types" (p. 12) lists fifteen: seven player
card types and eight encounter card types.

**Plan.** **`EffectSpec chooseCardType { player, bind }`** (a `choice` frame over the fifteen types, the types present
in the hand listed first for the client) and a query clause `cardTypeIs: { chosen: bind }`. The script: choose,
discard each hand card not of the type, `drawUpTo` hand size, place 1 threat per hand card of the type. Choosing a
type the hand cannot hold (villain) discards the whole hand and places threat only for nothing: legal by the ruling.
Log `cardTypeChosen { playerId, cardType }`.

### 3.34 A permanent side scheme that flips at no threat or on a villain stage's defeat

> **Status: partial.** Found: a permanent card is skipped by the defeat sweep (`isPermanent`, `resolve/defeat.ts`)
> and by "defeat" effects (`permanentStopsLeaving`, `resolve/event.ts`), so a permanent side scheme stays at 0 threat;
> `flipCard` to a same-type face; `revealNewFaceFrame` (the reveal of a new face, wave 6 §4.1 Q36, for villains);
> `RuleSpec cannotBeDefeated` on a villain (wave 3 §3.1); `cannotBeCanceled`; `advanceMainScheme { to }`; Victory X on
> a side scheme; hinder per player. Not found: a response to "the last threat is removed from this scheme" on a scheme
> that is not defeated by it (`schemeDefeated` is the only announcement), and a side scheme's flipped face going
> through the reveal (When Revealed, starting threat).

**Cards.** Stryfe's Grasp / Living Bomb (40168a/b).

**Plan.**

1. **The trigger.** Two responses on the a face: `characterDefeated` for a villain stage named Stryfe (it is
   announced for a stage that advances as well as for the last; verify), and `removeThreat` on self that leaves 0
   threat (the response's condition compares the scheme's threat with 0; no new event).
2. **The flip reveals.** `flipCard` then the new face's reveal: its When Revealed resolves and, per the answer to
   §4.2 Q19, its starting threat is placed on top of what is there. If `flipToOtherFace` already reveals an encounter
   face (§3.14 relies on the same for Hope's Captor b), this is a test; otherwise it is the same small addition for
   both cards.
3. **"Stryfe cannot be defeated"** while Living Bomb shows: `cannotBeDefeated`. His dial can sit at 0. When Living
   Bomb is defeated the rule ends: §4.2 Q21.
4. **Stage 2 by card text** is not a completion (§3.15, §3.12's `advancedBy: cardEffect`).

### 3.35 An attach host decided by a condition at reveal

> **Status: partial.** `impliedAttachHost: "ownWhenRevealed"` (wave 5) emits no `attachesTo`, and the card attaches
> from a scripted When Revealed (`attach`, `conditional`, `exists`). But this card's sentence is attach text, not a
> printed When Revealed, and no marker tells the engine a reveal-time ability is the card's attach instruction.

**Card.** Mental Transferal (40169): "If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your
identity."

**Decision.** The script carries one reveal-time ability:
`conditional(exists(inPlay(named("Stryfe's Grasp"))), attach(self, named("Hope Summers")), attach(self,
yourIdentity))`. `named` compares the showing face, so after the flip to Living Bomb it attaches to the revealing
player's identity although Hope Summers is in play (which is why `ifAble` of two hosts would be wrong).

**Gap.** The ability is flagged **`attachInstruction: true`** on its `AbilityDefinition`: it resolves at the reveal's
attach step (RRG "Reveal", step 2), before When Revealed abilities, and `cancelWhenRevealed` does not stop it. Without
the flag a canceled When Revealed would leave the card unattached and discarded, which the printed card does not
allow. No engine code names the card; Old Grudge and Fallen Warrior (true When Revealed attaches) do not set it.

### 3.36 Cards that enter play exhausted; "attacked and thwarted this phase"

> **Status: partial.** Found: `playFromHand.entersExhausted` (one play, Med Lab; wave 6 §3.57),
> `CostModifierSpec.delta` (a positive delta is an increase; wave 1 §3.10), `StatModifierSpec` on `handSize`,
> `basicRecovery`, `exhaustCards` costs, `GameState.attacksThisTurn` (attacks only, per turn). Not found: a constant
> rule that makes matching cards enter play exhausted, and a record of thwarts made this phase.

**Gaps.**

1. **Mind Trap** (40171): "Your allies, upgrades, and supports enter play exhausted." **`RuleSpec entersPlayExhausted
{ target, while? }`**, read where `entersExhausted` is (`resolve/play-card.ts`) and by `putIntoPlay`: placed
   exhausted, not exhausted by an effect, so no "when exhausted" ability sees it. A card changing controller is not
   entering play.
2. **Psychic Inertia** (40173): "Hero Action: If your hero attacked and thwarted this phase → discard this card."
   **`Predicate characterDidThisPhase { character, did: "attack" | "thwart" }`** over a per-phase record written
   where `attacksThisTurn` is and emptied at the phase boundary. §4.2 Q23 on which attacks and thwarts count.

Left to Your Fate's and Psionic Amnesia's cost increases, Tempo's and Left to Your Fate's hand size, and Mind
Alteration are in §3.39.

### 3.37 A villain stage's When Revealed during setup

> **Status: exists (verify).** `resolveScenarioSetup` (`setup-steps.ts`) pushes main scheme 1A's Setup, the main
> scheme's When Revealed, then each villain's Setup and When Revealed (RRG Appendix II step 12, p. 51); player
> "Setup" abilities resolve at step 16 (`playerSetupAbilities`).

**Cards.** Expert mode starts on stage II: Juggernaut II (a momentum counter, tough), Mister Sinister II (§3.28),
Stryfe II ("Each player discards … until a [PSIONIC] attachment is discarded and reveals that card", so every player
starts with one; Mental Transferal goes to Hope Summers because Stryfe's Grasp is already revealed by 1A's Setup).

**To verify.** `discardEncounterUntil` + `revealCard` per player in player order during setup, with the encounter
deck reshuffled if it runs out; ruling July 9, 2026 - Ruling 3 (1): "Players always resolve Alter-Ego setup abilities
regardless of setup form changes", so step 16 resolves an identity's alter-ego Setup abilities even if a setup effect
left it in hero form. A test with a synthetic form-changing reveal pins it.

### 3.38 Named encounter cards dealt facedown

> **Status: exists (verify).** `EffectSpec dealAsEncounterCard { cards, player }` (wave 3 §3.47,
> `deal-as-encounter-card.test.ts`): identified cards from the encounter deck or a discard pile go facedown to a
> player; `discardEncounterCards` with a bound result.

Psionic Surge (40177): "Discard the top X cards of the encounter deck … Deal each [PSIONIC] card discarded this way
to yourself as a facedown encounter card." PSIONIC is a trait of treacheries too (Psychic Override, Telekinetic
Wave). The campaign's "Shuffle Black Tom Cassidy and 1[per_hero] Creeping Willow minion together and deal one of
these cards to each player as a facedown encounter card" (MC40 p. 14) is the same effect over a shuffled selection;
its wiring is §3.45. A minion dealt facedown is revealed in step 4 like any encounter card (quickstrike and villainous
then apply).

### 3.39 Reusable as is, pass 1b (checked against the engine unions)

| Card text                                                                                                                          | Existing vocabulary                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| "If this stage is completed, the players lose the game" on a stage that is not the last (40166b)                                   | `MainSchemeStage.completionLoses` (wave 3 §3.37; `completionLoses`, `resolve/defeat.ts`). Also fits §3.15.   |
| "Hero Response: After you defend against an attack from Juggernaut, remove 1 threat from this scheme" (40124)                      | `defended` with an attacker filter, `removeThreat`                                                           |
| "Take damage equal to Juggernaut's ATK" / "place threat … equal to Juggernaut's ATK" (40125, 40126, 40129)                         | `ValueSpec stat`; `chooseOne` (§3.11, §4.2 Q8)                                                               |
| "Discard the highest-cost upgrade or support you control" (40125); lowest / highest cost upgrade (40158, 40182, 40183)             | `superlative` over `printedCost` (§3.4), `discardFromPlay`, `moveCards` to the owner's hand                  |
| "The players as a group take indirect damage equal to …" (40127, 40154)                                                            | `dealIndirectDamage` to the group (RRG p. 24)                                                                |
| "Juggernaut attacks the ally with the fewest remaining hit points" (40128)                                                         | `enemyAttack.targetCharacter` with `superlative`                                                             |
| "In expert mode, this card gains incite 1" (40129)                                                                                 | `inMode` keyword grant (the Frequent Flyers shape, `abilities.ts`)                                           |
| "Spend 1 resource for each damage dealt by that attack → discard this card" (40123)                                                | a resource cost with a `ValueSpec eventResult` amount                                                        |
| Black Tom: villainous; "cannot take damage while Creeping Willow is in play"; search and put into play engaged                     | `cannotTakeDamage` with `while exists`; `find` + `putIntoPlay` engaged                                       |
| Creeping Willow: guard, quickstrike; "After Creeping Willow attacks and damages a character, stun that character"                  | `enemyAttack` results `<bind>.damaged`; `giveStatus`                                                         |
| Making Green: hinder 2 per player; "Each copy of Creeping Willow gains surge"                                                      | `hinder.perPlayer`; a keyword granted to a card being revealed (wave 6 §3.65)                                |
| A Sound Thrashing: each Willow attacks its engaged player; "If you were not attacked this way, search … and reveal"                | `enemyAttack` over a query with `<bind>.made` per player; `find` + `revealCard`                              |
| "Mister Sinister cannot take damage" / "When Mister Sinister would attack, he schemes instead" (40146)                             | `cannotTakeDamage`; §3.14                                                                                    |
| "If Mister Sinister has the following traits: …" (40147–40150, 40154, 40158, 40162)                                                | `conditional` on `hasTrait` with granted traits (`traitGrants`)                                              |
| Sinister Soldier: "+1 SCH and +1 ATK for each [SUPERPOWER] attachment"; boost "For this activation, …"                             | constant modifier with a `count`; `modifyStatUntil` for the activation (`activation-scoped-effects.test.ts`) |
| "Deal each player 1 facedown encounter card" (40143a)                                                                              | `dealEncounterCard` (ruling Jan 26, 2026 (4) answer 3, already in its doc)                                   |
| Impervious: "Reduce the amount of damage attached villain takes from each attack by 1"                                             | `reduceDamageTaken { fromAttack }`                                                                           |
| Thrown Object: "attacks gain ranged"; "After the villain attacks, discard this card"                                               | `attackKeywords`; `enemyAttack` response                                                                     |
| High Ground: "Discard each tough status card from each friendly character"; boost "this attack gains piercing"                     | `removeStatus` over a query; a boost granting an attack keyword (§3.11's list)                               |
| Manufactured Drama / Sowing Discord: "Supports [allies] you control cannot ready"; exhaust each; surge if none                     | `cannotReady`; `exhaust` over a query with a count; `gainSurge`                                              |
| "Discard 1 card from the top of your deck for each support you control → discard this card" (40160)                                | deck-discard cost with a `ValueSpec` (`deck-discard-cost.test.ts`)                                           |
| One Step Ahead: "Discard 1 random card from your hand"                                                                             | random hand discard (core)                                                                                   |
| "Stryfe gains stalwart. Each identity gets +2 hand size. Increase the resource cost to play each player card by 1."                | keyword grant; `StatModifierSpec handSize`; `CostModifierSpec` with `delta: 1`, after §3.4's multiplication  |
| Mind Alteration: "After you play an event or upgrade, take 1 damage"; "After you recover, spend [mental] → discard"                | `cardPlayed` response; `basicRecovery` response with a typed resource cost                                   |
| Psionic Amnesia: "+2 cost of each ally and support you play"; "After you play an ally or support, exhaust your identity → discard" | `CostModifierSpec`; `cardPlayed` response with an exhaust cost                                               |
| Mental Transferal: "After Stryfe takes any amount of damage, attached character takes an equal amount"                             | `dealDamage` response reading the event's damage taken (`eventResult`)                                       |
| Zero: guard, patrol, toughness; shuffled back unless the defeating player holds 3 of a type                                        | `whenDefeated` with `defeatingPlayer`, §3.32, `moveCards` to the encounter deck                              |
| Cerebral Erasure, Telekinetic Wave, Thumbelina, Wildside: "Return an upgrade or support … to its owner's hand"                     | `moveCards` to the owner's hand; `defeatingPlayer` (§4.2 Q2)                                                 |
| Telekinetic Wave: "Stryfe activates against you"                                                                                   | `enemyActivation` (attack or scheme by form)                                                                 |
| Strobe, Wildside, Samurai: "Choose:" two options                                                                                   | `chooseOne` (§3.11, §4.2 Q8); Samurai's charge counters as `addCounters` + `counters`                        |
| Tempo: "+1 hand size" while engaged; "discard cards from the top of your deck equal to twice the number …"                         | `StatModifierSpec handSize` with `while`; a deck-top discard with a `scaled` hand count (verify the effect)  |
| Extreme Measures: "After a player card enters play, its controller takes indirect damage equal to … printed cost"                  | `cardEntersPlay` response; `printedCostOf` (§3.4)                                                            |
| Dragoness, Forearm, Reaper: "the number of [energy] resources in your hand"                                                        | `ValueSpec printedResourcesOf` over the hand (a wild icon is not an [energy] icon)                           |
| Mutant Insurrection: assault; "Each minion gains toughness"; 2 threat per MLF character, surge if none                             | §3.3; keyword grant to entering minions (wave 6 §3.65); `placeThreat` with a `count`; `gainSurge`            |
| Captive Hope: "Hope Summers cannot ready. When Revealed: Exhaust Hope Summers."                                                    | `cannotReady`; `exhaust`                                                                                     |

### 3.40 A campaign choice a retry must repeat

> **Status: partial.** `CampaignOp choose { chooser: "group", from: { kind: "fieldOptions", unstruckOnly: true } }`,
> `strike`, `setField` and `appendToList` exist (`packages/engine/src/campaign.ts`, resolved in `campaign/ops.ts`), and
> `LossPolicy.retryBaseline: "nodeStart"` already rolls a lost node's choice and reward back (`applyCampaignResult`,
> `campaign/runner.ts`: "a side scheme picked for it — is rolled back"). What is missing is the other half of MC40
> p. 7: the retry **asks again** and offers every unstruck option, so the players could pick a different scheme.

**Rules.** MC40 p. 7: "When the players replay a scenario after losing, they must choose the same player side scheme
for that scenario and defeat it in order to earn its reward, even if they defeated it during a game they lost."
Foundation row 58 (`docs/campaign-mode-design.md`, its Q6).

**Plan.** An optional flag on the existing op, no new union member: **`choose.repeatOnRetry?: true`**. When
`resolveBetweenGames` reaches such an op for a node whose latest `CampaignLog.history` entry is a lost attempt at the
same node, it takes that attempt's recorded `CampaignChoiceRecord.picked` for the slot (and seat) as the answer
instead of raising a pending choice. The history already holds it, so no new log state and no change to a save. The
step trace records the choice with `repeated: true` so the log shows the choice was not offered. The ops that follow
(strike, the per-scenario `choice` field, the encounter card appended to `encounterCards`) run as on the first
attempt, from the restored baseline.

- The **Victory** `record` step writes `environmentsEarned`, so a scheme defeated in a lost game earns nothing with
  no extra rule; this half already works.
- Not an in-game `recordInCampaignLog` (which would survive the loss by design §6.2): the choice is the players' and
  is made before the game is built, where the Briefing shows it.
- Tests in `campaign/runner.test.ts`: win after a loss keeps the first pick and asks nothing; a different node's
  `choose` without the flag still asks; a retry after two losses reads the latest attempt.

**Composes with:** any later box whose rulebook pins a retry to the first choice.

### 3.41 Damage on a card, read out of the finished game

> **Status: missing (small).** `CampaignGameQuery` (`packages/engine/src/campaign.ts`, answered in
> `campaign/result.ts`) reads `countersOn`, `threatOn` and `remainingHitPointsCappedAtBase` (identities only). Damage
> is `CardInstance.damage`, not a counter, so no member reads "the amount of damage on Hope Summers".

**Rules.** MC40 pp. 14, 16, Victory: "Record the amount of damage on Hope Summers in the campaign log."

**Plan.** `{ kind: "damageOn"; query: TargetQuery }`, the sibling of `threatOn`: the sum of `damage` over matching
cards in play at the end of the game; nothing matching reads 0. One case in `evaluateQuery`, one test beside
`sm-queries.test.ts`. The log write is `{ field: "hopeDamage3", mode: "set", value: damageOn(Hope Summers) }`.

**Reads back with** the existing `ValueSpec campaignLog` (`campaignLogValue("hopeDamage3")`, `packages/cards/src/dsl/
values.ts`) in the next scenario's choice (§3.45).

### 3.42 The starting villain put into play by the main scheme's Setup

> **Status: partial.** `GameSetupConfig.villainsStartSetAside` (`packages/engine/src/setup.ts`; wave 5 §3.1, The
> Sinister Six), `addVillain`, `encounterSetAside(filter, { random })` on the seeded RNG and "zero villains in play is
> legal" exist (`set-aside-villains.test.ts`). `createGame` refuses the flag without `villains` ("villainsStartSetAside
> needs villains"), and `randomStartingVillain` draws in `createGame`, before the first campaign window
> (`FIRST_CAMPAIGN_STEP`, `setup-steps.ts`).

**Rules.** MC40 p. 11: "Before resolving the 'Setup' text on Gotta Get Away (103A), remove each villain card recorded
in the campaign log under 'Marauders Defeated' from the game. (Minion cards with the same title remain in the
encounter deck.)" Then 1A: "Put 1 random [MARAUDER] villain into play. Remove the minion with the same title as the
villain, along with each other villain, from the game."

**Plan.**

1. Lift the `villains` requirement: a single-villain game may start with every villain card set aside
   (`Scenario.startingVillain: "bySetup"`, §1.21). Until 1A's Setup resolves, "the villain" is nobody, as for The
   Sinister Six.
2. Gotta Get Away 1A's `setup` script, amending §3.13: `addVillain` one random set-aside villain; remove every other
   set-aside villain and the minion sharing its title from the game; attach Hope's Captor. Standalone play is
   unchanged in outcome.
3. The campaign instruction is `inGame`, window `beforeScenarioSetup`: move `campaignLogCards("maraudersDefeated", {
byName: true, filter: villain })` from the set-aside area to `removedFromGame` (`moveCards`, both existing).
   `byName` matters: scenario 1 recorded one mode's face of each title and scenario 2 may be played in the other mode.
4. Test: with three titles recorded, 200 seeds never start one of them, and their three minions are still in the
   encounter deck unless the drawn villain shares the title.

**Composes with:** any scenario whose Setup text chooses its own villain after a campaign step.

### 3.43 A campaign player side scheme put into play, flipping to an environment

> **Status: partial.** Found: `setAsideCards` (campaign op) + `putIntoPlayFromSetAside` (the route every campaign card
> takes, `mut_gen.ts`'s Jubilee); `flipCard` on a card with `otherFaceId` → `resolve/other-face.ts flipToOtherFace`
> (wave 4 §3.10: a different type discards tokens and attachments, an environment goes to the villain's area, "the
> new face is then treated as entering play", and a defeated side scheme that flipped in its own When Defeated stays in
> play while `schemeDefeated` still fires). Not found: a player side scheme entering play **without being played**.
> Its placement, controller and starting threat are set in `executePlayCardFrame` (`resolve/play-card.ts`), and
> `enterPlay` returns early for the type (`resolve/enter-play.ts`).

**Cards.** 40190a–40195a: "This scheme does not count against the player side scheme limit. When Defeated: Flip this
card and put [its environment] into play." Put into play by the campaign's "choose" block (§2.10). The same gap is hit
by Technovirus Purge put into play by Technovirus Resurgence (MC40 p. 21; pass 2a).

**Plan.**

1. **Entering play by an effect.** Move the type's placement into the shared enter-play path: `villainArea`, starting
   threat `scale(startingThreat, startingPlayerCount)` plus hinder (RRG p. 34: "Each player side scheme enters play
   with an amount of threat on it equal to its starting threat value"), the uniqueness check, then §3.2's limit check
   (first player chooses when an effect put it in). `executePlayCardFrame` calls the same function.
2. **No controller** when a campaign instruction puts it in (§4.2 Q24): it is nobody's card, so an eliminated
   player's sweep (§3.1 gap 5) leaves it, and it has no discard pile to go to; if anything would discard it, it is
   removed from the game (RRG "Double-Sided Card", p. 17).
3. **The exemption** is §3.2's `excludedFromPlayerSideSchemeLimit { target: self }`, a constant on each a face.
4. **The flip** is `whenDefeated(flipCard(self))`. To verify with a player side scheme front: the leave-play guard
   (`refMatches self { printedId }`) holds for `applySchemeDefeated`'s player side scheme branch; the environment's
   "Enters play with 1 assembly counter on it" resolves on the flip; `cardFlippedToOtherFace` is logged.
5. One test file, `campaign-player-side-scheme.test.ts`: put into play with 4 per player threat at 1 and 3 players;
   not counted by the limit with one and two other player side schemes in play; thwarted to 0 → an environment with
   its counter, in play, the a face nowhere; a player eliminated while it is in play.

### 3.44 A minion that stays in play attached to an ally it treats as a minion

> **Status: partial.** The host's half exists and is shipped for four cards: `RuleSpec treatHostAsMinion { traits,
keepPrintedTraits?, schFromThw? }` (`packages/engine/src/abilities.ts`; `treat-as.ts syncTreatedAs`;
> `CardInstance.treatedAs`; wave 4 §3.9, `treat-as-minion.test.ts`; DSL `constant(treatAttachedAllyAsMinion(traits, {
keepPrintedTraits }))`, used by Fallen Warrior, Beguiled, Manipulated Mind and Possessed). Its doc comment already
> names Malice and 'Pool-ized. **'Pool-ized composes today** (below). Malice's other half does not exist: the card
> doing the attaching is a **minion**, attached by its own When Defeated, that stays in play as a minion.

**Cards.** Malice (40199): "When Defeated: Attach Malice to the non-[PSIONIC] ally with the highest cost. Attached ally
engages its controller. Treat attached ally as a [POSSESSED] minion with a blank text box (except for [TRAITS]).
Attached minion's SCH is equal to its THW and it does not take consequential damage." 'Pool-ized (`deadpool` 44041 ×2,
erratum RRG p. 69): "Treat attached ally as a ['POOL] minion with a blank text box. Attached minion's SCH is equal to
its printed THW and it does not take consequential damage. When Revealed: Attach to the ally with the highest cost
without 'Pool-ized attached. Attached ally engages its controller. Otherwise, this card gains surge."

**Rules.**

- RRG 1.8 FAQ, Malice (#199), p. 64: "While Malice is attached to an ally: She retains the minion card type. She
  retains any damage on her. She can be attacked and targeted by card abilities (including attachments) like any
  minion, but cannot be defeated again, even if she gains hit points or heals damage. She is not considered engaged
  with a player and so cannot activate. She is discarded when the card to which she is attached leaves play."
- December 17, 2025 - Ruling 1, answer 3: the ally "does not leave play and the 'minion' does not enter play; the
  character remains in play and retains all tokens and attachments."
- June 25, 2026 - Ruling 4, answer 5: "Characters not under player control are not friendly characters", so the
  treated ally is no target for "a friendly character" or "an ally you control" (`treatedAs` already clears its
  controller). Answer 1 ("Nemesis sets belong to that identity"): set membership is not text box content, so a blank
  text box does not change which set or which identity a treated ally belongs to; it is still its owner's card and
  goes to its owner's discard pile when it is defeated.

**One primitive, two ways in.** What both cards share is "a card attached to an ally makes that ally a minion": the
rule is read off whatever is attached, and `syncTreatedAs` runs whenever a card lands on or leaves a host
(`relocateCard`). The table is the whole difference between them:

|                    | 'Pool-ized 44041                                                                                         | Malice 40199                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The attaching card | an attachment, on reveal                                                                                 | a minion, from its own When Defeated                                                      |
| Host               | `superlative { among: "ally", order: "highest", measure: "printedCost", withoutAttachmentNamed }` (data) | the same measure with `withoutTrait: PSIONIC`, as a `TargetRef superlative` in the script |
| No host            | "this card gains surge"                                                                                  | nothing to attach to: she is defeated and discarded as any minion                         |
| Traits             | `['POOL]` only                                                                                           | `[POSSESSED]` plus the printed ones (`keepPrintedTraits`)                                 |
| SCH                | "its **printed** THW" (`schFromThw`, read from the card today, `query.ts`)                               | "its THW" (§4.2 Q27)                                                                      |
| Status             | **exists (verify)**: one scripted test at pass 2c                                                        | **partial**: items 1–4 below                                                              |

**Plan (Malice's half, general).**

1. **A character card attached to a card.** `EffectSpec attach` accepts any card (`resolve/apply-effect.ts`, "Any card
   in play may be the host"); verify `attachCard` on a minion clears `engagedWith`, keeps `damage`, and leaves the
   card in play with its type: still matched by `minion` and `enemy` queries, so it can be attacked and targeted
   (guard and patrol on it would apply; Malice prints neither), and not matched by "engaged with you".
2. **A When Defeated that keeps its card in play.** The minion defeat sequence must not discard a card its own When
   Defeated attached (the guard wave 4 §3.10 added for a side scheme that flips: same instance, no longer where the
   defeat left it). `characterDefeated` still fires once: she was defeated, and "after you defeat a minion" responses
   resolve.
3. **Not defeated again.** A character that is attached to another card is skipped by the zero-hit-point state check
   (`resolve/defeat.ts`), whatever its damage or hit points. Stated as the general rule the FAQ implies rather than a
   flag on one card; no other printed card attaches a character to a character today.
4. **No activation.** Activation walks minions engaged with a player; with `engagedWith` null she is not in the walk.
   Verify `enemyActivation` aimed at her by an effect ("each minion activates") also skips an attached character.
5. **Leaving with the host.** Attached cards are discarded when their host leaves play (existing); she goes to the
   encounter discard pile and can return in a later round.
6. Log: the existing card-moved event for the attach and `treatedAsChanged`. Tests in `treat-as-minion.test.ts`: the FAQ's five
   bullets, one each; a tie for the highest cost is the first player's choice (RRG p. 19); every player's allies are
   candidates; the possessed ally defeated by a player goes to its owner's discard pile and Malice to the encounter
   discard pile.

**Composes with:** "Lost" Child (`jubilee` 47027) and Reluctant Foe (`aos` 50171) later; §4.2 Q26, Q27.

### 3.45 Cards the campaign log carries into each game

> **Status: exists (verify).** `CampaignOp setAsideCards` (cards from outside the scenario, created set aside),
> `putIntoPlayFromSetAside`, `moveCards` with the `campaignLog` selector to `encounterDeckShuffle` (`trors.ts`'s
> Experimental attachments, foundation row 30), `ValueSpec campaignLog` and the `campaignLogAtLeast` / `campaignLogHas`
> predicates, `CampaignGameQuery cardsInPlay` / `cardsTuckedUnder` / `count`, `LogWriteSpec.distinct`, `removeFromCampaign`.

| Instruction (MC40 page)                                                         | Composition                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Put the chosen scheme into play (pp. 9–18)                                      | `setAsideCards` the chosen a face (§3.40's slot), then `inGame` `putIntoPlayFromSetAside` (§3.43)                                                                                                                                                        |
| Shuffle each chosen row's encounter card into the encounter deck                | `appendToList encounterCards`; `setAsideCards [field("encounterCards")]`; `moveCards` to `encounterDeckShuffle`                                                                                                                                          |
| Put each earned environment into play "in any order" (pp. 11–18)                | `setAsideCards [field("environmentsEarned")]` (the b face ids); `putIntoPlayFromSetAside`. Each enters play, so the three with a counter get it again every scenario. Order does not matter: none reads another                                          |
| "Mark each campaign environment in play as 'Earned'" (Victory)                  | `record`: `append` with `distinct` of `cardsInPlay { categories: ["environment"], inEncounterSet: next_evol_campaign }`                                                                                                                                  |
| A chosen scheme not defeated by the win "is removed from the campaign" (p. 7)   | Victory `betweenGames`: if `environmentsEarned` lacks this scenario's row, `removeFromCampaign` both faces. Its encounter card stays in `encounterCards`                                                                                                 |
| Marauders Defeated, Morlocks Saved (p. 9)                                       | `cardsTuckedUnder { under: Routed, query: villain }` (§3.7); `count(cardsInPlay(Morlock allies))`                                                                                                                                                        |
| Each Morlock saved: a chosen player searches their deck for one card (p. 11)    | one gated copy per possible count (`campaignLogAtLeast("morlocksSaved", k)`, k = 1–4): `choosePlayer` by the first player, then that player's deck search to hand and shuffle (`findCard`)                                                               |
| "Give each enemy a tough status card" if an environment is earned (p. 11)       | `giveStatus` over `{ categories: ["enemy"] }`, gated on `count(environmentsEarned) ≥ 1`                                                                                                                                                                  |
| A momentum counter / 1 per player threat for each campaign environment in play  | `addCounters` / `placeThreat` with a `count` of environments of the campaign set in play (times `perPlayer`)                                                                                                                                             |
| Black Tom Cassidy and 1 per player Creeping Willow dealt facedown (p. 14)       | select the named cards from the encounter deck, `dealAsEncounterCard` one at random to each player (§3.38), the last back with `encounterDeckShuffle`. **Verify** a random pick from a bound slot, and the count with only some Willows left in the deck |
| Put Teleported Away into play (p. 16)                                           | `findCard` in the encounter deck and discard pile → put into play: starting 3 plus hinder 1 per player (RRG "Hinder X", p. 22), then the per-environment threat                                                                                          |
| Hope Summers's damage or that much threat (pp. 16, 18)                          | `chooseOneBy(firstPlayer, option(placeDamage(campaignLogValue(…), Hope Summers)), option(placeThreat(…, the scheme)))`, skipped at 0 (foundation row 59). The players as a group decide; the first player enters it (RRG "First Player", p. 19)          |
| Discard until a minion or a PSIONIC attachment and reveal it; reshuffle (p. 18) | `forEachPlayer` in player order: `discardEncounterUntil` with an either-or filter, `revealCard`; then the encounter discard pile → `encounterDeckShuffle`. The filter is `TargetQuery.anyOf` (a minion, or an attachment with PSIONIC)                   |

**To verify first:** that `setAsideCards` accepts a card id recorded in a `cardList` whose card is the b face of
another record (40190b), and that a card removed from the campaign is skipped by it.

### 3.46 The expert campaign: persistent damage, elimination, rejoining

> **Status: exists (compose).** `mut_gen.ts`'s `hpRecord` (`remainingHitPointsCappedAtBase`), `hpSet`
> (`setRemainingHitPoints(campaignLogValue("remainingHp", { seat }))`) and `healToFull` (an acceleration token, forced
> for a seat recorded at 0); `mojo.ts`'s `healWithFacedownCard` (`dealEncounterCard`, same forcing);
> `CampaignDefinition.elimination` (`EliminationPolicy`: a seat eliminated in a won game takes no part in the Victory
> steps); the last node's expert `defeat` → `endCampaign lost`.

MC40 p. 7 and the five Campaign Instructions use exactly these four sentences. Scenarios 2 and 4 use `healToFull`,
scenarios 3 and 5 `healWithFacedownCard`; scenario 1 only records. **Ask of the scripting agent:** move the two heal
helpers and the two hit point helpers into a shared `packages/cards/src/campaigns/expert-helpers.ts` rather than
copying them a fifth time (wave 6 §3.72 already asked for the facedown one to be shared). No engine change.

### 3.47 "A printed cost of N or more" as a query

> **Status: missing (small).** `TargetQuery.maxPrintedCost` exists (`packages/engine/src/spec.ts`); there is no
> lower bound and no negation on `TargetQuery`. `CostModifierSpec { delta, appliesTo }` exists.

Practiced Maneuvers (40194b): "Reduce the cost to play each event with a printed cost of 3 or more by 1." **Plan:**
`TargetQuery.minPrintedCost?: number | ValueSpec`, read through §3.4's `printedCostOf`, so Team Investigation
(2 per player) is 4 at two players (ruling Aug 3, 2026 (5)) and qualifies, and 2 in a solo game and does not. A dash
or an X cost reads as 0 and never qualifies. The constant is `costModifier({ delta: -1, appliesTo: { categories:
["event"], minPrintedCost: 3 } })` for every player.

### 3.48 Reusable as is, pass 1c (checked against the engine unions)

| Card text                                                                                                                                                      | Existing vocabulary                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| "Enters play with 1 assembly / safehouse / pouch / prep counter on it" (40190b–40193b)                                                                         | an enters-play `addCounters` (the flip counts as entering play, wave 4 §3.10)                                                      |
| "Action: Remove 1 … counter from here → …" with "(Any player can do this.)"                                                                                    | a counter cost; an Action on an encounter-side card is any player's (December 17, 2025 - Ruling 1, answer 1)                       |
| Team Assembled: "each player may search their deck and discard pile for an ally with a printed cost of 3 or less and put it into play"                         | `forEachPlayer`, optional `findCard` over deck and discard with `maxPrintedCost`, put into play (the ally limit applies)           |
| Mission Prepped: "each player searches their deck and discard pile for 1 upgrade with a printed cost of 2 or less and puts it into play"                       | as above, not optional; an upgrade with an "Attach to" line needs a legal host or stays where it was                               |
| Safehouse Established: "the first player puts the Safehouse support into play under their control"                                                             | Safehouse is in `setAsideCards` whenever the environment is; `putIntoPlayFromSetAside` under `firstPlayer`                         |
| Geared Up: "each player shuffles 1 copy of the Pouches resource card into their deck"                                                                          | four set-aside copies; `moveCards` one to each player's `deckShuffle`, that player its owner for the game (§4.2 Q25)               |
| Prepared Defenses: "Each hero gets +1 DEF and gains retaliate 1."                                                                                              | `StatModifierSpec` DEF and a keyword grant over identities in hero form                                                            |
| Safehouse: "Alter-Ego Action: Choose: heal 2 damage from your identity / draw 1 card. Any player may trigger this ability. (Limit once per round per player.)" | `chooseOne`; `triggerableBy` any player (wave 6 §3.11); a limit keyed `"player"` (`abilities.ts`); "your" is the triggering player |
| Pouches: two [wild] resources, no text                                                                                                                         | data only                                                                                                                          |
| Lady Mastermind: "Take X damage, where X is the printed cost of the event in your hand with the highest cost"; boost "Discard an event from your hand"         | `superlative` over the hand with `ValueSpec printedCost` (§3.4); 0 with no event; a hand discard with a type filter                |
| Scrambler: "Discard an upgrade you control."                                                                                                                   | a chosen `discardFromPlay`                                                                                                         |
| Vanisher: "Return the support you control with the highest cost to your hand" (When Revealed and boost)                                                        | `superlative` over `printedCost`, `moveCards` to the owner's hand (§3.39's row)                                                    |
| Under Pressure: surge; amplify icon; boost "Give the villain 1 additional boost card for this activation"                                                      | `schemeIcons`; `giveBoostCard(theVillain)` from a boost ability                                                                    |
| Overburdened: "Choose to either discard 1 resource card from your hand or take 2 damage" (When Revealed and boost)                                             | `chooseOne` (§3.11, §4.2 Q8: with no resource card in hand the damage is forced)                                                   |
| Surge on all six encounter cards                                                                                                                               | the keyword                                                                                                                        |

### 3.49 The victory display as a place cards are taken from and sent to

> **Status: missing.** The victory display is only ever counted (`ValueSpec victoryDisplayCount { filter }`,
> `packages/engine/src/spec.ts`; `victoryDisplayCount` in `packages/cards/src/dsl/values.ts`) or entered by the
> engine itself (Victory X in `discardFromPlay { defeated: true }`, `addMainSchemeStageToVictoryDisplay`). No
> `CardSelector` names it (the union has `zone`, `encounter`, `setAside`, `encounterSetAside`, `removedFromGame`,
> `scenarioArea`, `tucked`, …) and `CardDestination` has no `"victoryDisplay"`. `findCard` deliberately skips it (RRG
> "Find", p. 19).

**Cards.** Forced Amnesia (40010): "Hero Response: After a (non-permanent) side scheme is defeated, add Forced Amnesia
and that side scheme to the victory display." Temporal Leap (40013): "… put a side scheme from the victory display
into play → move 4 threat from the main scheme to that side scheme." Technovirus Resurgence (40031): "Search your
deck, discard pile, hand, and victory display for Technovirus Purge and put it into play."

**Rules.** RRG 1.8 "Victory Display" (p. 46): "an out-of-play game area shared by all players. Cards in the victory
display follow the standard rules for out-of-play cards." "Side Scheme" (p. 40): "Each side scheme enters play with an
amount of threat on it equal to the card's starting threat value." "Leaves Play" (p. 27): placing a card in the
victory display is one way of leaving play.

**Plan.**

- **`CardSelector { kind: "victoryDisplay"; filter? }`**, read by `chooseCards`, `selectCards` and `anyOf` (40031's
  four areas are one pool, the `zone` selector's own rule for several zones).
- **`CardDestination "victoryDisplay"`** for `moveCards`: from play it is a leave (`cardLeavesPlay`, no When Defeated,
  not a defeat); from a discard pile it is a plain move. Forced Amnesia is `on.schemeDefeated` (not permanent), then
  `moveCards` of itself and of `eventTarget`. The defeated scheme is in a discard pile by then (or already in the
  victory display with Victory X: only the upgrade moves; or gone elsewhere by its own When Defeated: only the
  upgrade moves). Forced Amnesia in the victory display is an upgrade, so "each side scheme in the victory display"
  does not count it.
- **`putIntoPlay` from the victory display**: an encounter side scheme goes to the villain area with its starting
  threat and is **not revealed** (no When Revealed, no hinder or surge; §4.2 Q30); a player side scheme goes through
  §3.1 and the limit (§3.2), under its owner's control.
- Log: the existing `cardsMoved` and `cardEnteredPlay`, with `from: "victoryDisplay"`.

**Composes with:** `victoryDisplayCount`, which every other Cable card reads (§3.61).

### 3.50 A constant ability that works from the victory display

> **Status: missing.** `AbilityDefinition.activeIn` is `"hand"` only (`packages/engine/src/abilities.ts` ~line 386;
> read in `rules.ts`, `resolve/triggers.ts`, `legal.ts`). Constants are otherwise collected from cards in play.

**Card.** Technovirus Purge (40006): "While Technovirus Purge is in the victory display, Nathan Summers and Cable gain
the PSIONIC trait and Cable gets +1 THW, +1 ATK, and +1 DEF."

**Rules.** RRG "Victory Display" (p. 46) with "In Play and Out of Play": an out-of-play card's ability works only
where its text says so; this one names the area.

**Plan.** `activeIn: "hand" | "victoryDisplay"`. A `"victoryDisplay"` constant is collected while its card is in the
victory display and at no other time; "you" is the card's owner. The script is two parts on one constant: a trait
grant to the identity titled Nathan Summers / Cable (both faces: PSIONIC turns on Mind Scan-style play restrictions,
Psimitar and The Power of the Mind for Cable, and makes the nemesis Stryfe cancel his PSIONIC events) and
`gets` THW/ATK/DEF +1 for the hero face only. It ends the moment Technovirus Resurgence takes the card out (§3.53).
No log event: a constant; the client reads it from the active-rules view like any other.

### 3.51 "Characters other than X cannot remove threat from here"

> **Status: partial.** `RuleSpec threatCannotBeRemoved { target, while?, by?, player? }` (`abilities.ts`): `player`
> scopes by the removing **player** ("Players other than Gamora cannot remove threat from Sibling Rivalry",
> `wave3/gam/gamora-obligation-nemesis.ts`). Nothing scopes by the removing **character**, and Cable's own allies are
> his player's.

**Card.** Technovirus Purge (40006): "Characters other than Cable cannot remove threat from Technovirus Purge."

**Rules.** RRG Appendix I (p. 49): events Cable's player plays and upgrades they control (unless attached to another
friendly character) are performed by Cable; allies, supports, player side schemes and encounter cards are not.
`isIdentityExtension` (`packages/engine/src/select.ts`) is that list.

**Plan.** `threatCannotBeRemoved.exceptBy?: TargetQuery`, the sibling of `cannotTakeDamage.exceptFromSource`: the
removal is allowed when the card that performs it (`removeThreat`'s source, the `schemeDefeated.sourceInstanceId`
reading) matches; here `{ titled: "Cable", categories: ["identity"] }` or an extension of that identity. An ally of
Cable's player, another hero, and Team Investigation played by another player are blocked. `legalActions` does not
offer a blocked basic thwart; `why-not.ts` gets the reason. Whether a remover that is **not a character** (E.V.A., an
encounter card) is blocked is §4.2 Q29. Nathan Summers is not "Cable": in alter-ego form nothing of his removes
threat from it either.

### 3.52 "After [identity] defeats a side scheme"

> **Status: exists (verify).** `TriggerEvent schemeDefeated { instanceId, defeatedByPlayerId, sourceInstanceId }`
> (`trigger-events.ts`: the thwarting character for a basic or "(thwart)"-labeled thwart, else the card whose effect
> removed the last threat), `on.schemeDefeated` (`dsl/abilities.ts`), and `TargetQuery.extensionOf` (`spec.ts`;
> Death-Glow's "If Valkyrie defeated that enemy" is `refMatches(eventSource, { extensionOf: you }, anywhere)`).

**Card.** Cable (40001a): "Response: After Cable defeats a side scheme, ready him. (Limit once per phase.)" The
condition is `refMatches(eventSource, { extensionOf: you }, anywhere)` on `schemeDefeated`, in hero form, with a
phase limit. It counts his basic thwart, Mind Scan, Askani'son, Team Investigation or Even the Odds he plays (RRG
p. 49); it does not count his allies, E.V.A. or an encounter effect. **Verify in a test:** that `eventSource` on a
`schemeDefeated` event is `sourceInstanceId`; a player side scheme and an encounter side scheme both trigger it;
the limit resets in the villain phase (Askani'son thwarts there). Graymalkin, Mission Leader and Forced Amnesia are
the unscoped "a side scheme is defeated": any scheme, any defeater.

### 3.53 An obligation that puts a player side scheme into play and attaches to it

> **Status: partial.** Depends on §3.2 (the limit), §3.49 (the victory display as a source) and §3.43's enter-play
> path. `attach` takes any host (`EffectSpec attach`); an obligation attached to a scheme has no earlier card:
> verify.

**Card.** Technovirus Resurgence (40031): "Give to the Nathan Summers player. When Revealed: Search your deck, discard
pile, hand, and victory display for Technovirus Purge and put it into play. (Shuffle.) Attach this card to Technovirus
Purge. If you cannot, discard this card and deal yourself 1 facedown encounter card."

**Rules.** MC40 p. 21: "The first player chooses one player side scheme in play to discard, which could include
Technovirus Purge. If Technovirus Purge is discarded, Technovirus Resurgence cannot attach to it, and so its text
deals Cable's player a facedown encounter card." RRG "Player Side Scheme Limit" (p. 34).

**Sequence.**

1. Technovirus Purge already in play: nothing is searched for; attach to it.
2. Otherwise choose it from the four areas (one pool), put it into play with 5 threat under its owner's control,
   shuffle the deck if it was searched. The limit check runs as it enters (§3.2): the first player chooses.
3. Purge in play after step 2: attach the obligation to it. The obligation has no other text; it leaves play with
   the scheme (the host leaving), to the encounter discard pile, and the scheme goes back to the victory display on
   defeat.
4. Purge not in play (discarded by the limit, or nowhere to be found: removed from the game): discard the obligation
   and `dealEncounterCard` to that player.

Leaving the victory display ends §3.50's bonus at once, which is the obligation's cost. The script is
`selectCards`/`chooseCards` over `anyOf(zone(deck, discard, hand), victoryDisplay)`, `putIntoPlay`, then
`ifThen(exists(Purge in play), attach(self, it))` with the `else` branch; no new vocabulary beyond §3.49.

### 3.54 "When the main scheme would be completed" on a player card

> **Status: exists (verify).** `TriggerEvent mainSchemeCompleting` (`trigger-events.ts`, wave 4 §3.4: "Pushed only
> when an ability listens; its apply step completes the stage … unless an interrupt cancelled it or the threat has
> fallen below the target") and `on.mainSchemeCompleting`. Every listener so far is the main scheme's own Forced
> Interrupt.

**Card.** Temporal Leap (40013): "Hero Interrupt: When the main scheme would be completed, remove this card from the
game and put a side scheme from the victory display into play → move 4 threat from the main scheme to that side
scheme."

**Plan.** No new event. The cost is two parts, `moveCards(self, "removedFromGame")` and §3.49's put into play (with
no side scheme in the victory display the cost cannot be paid and the ability is not offered); the effect is
`moveThreat { from: mainScheme, to: chosen, amount: 4 }` (RRG "Move", p. 30: removed from one, placed on the other).
The apply step then finds the threat below the target and the stage is not completed. **Verify:** a player card
hears the event (the "only when an ability listens" gate reads upgrades in play); fewer than 4 threat above the
target still saves the stage; a stage whose target was passed by more than 4 is still completed; "cannot remove
threat from the main scheme" rules (crisis icons do not apply to a move by a card ability; `threatCannotBeRemoved`
does) are honored. §4.2 Q30.

### 3.55 A player-deck discard as an event the discarded card can answer

> **Status: missing.** Cards are discarded from a player deck by `moveCards(topOfDeck(n), "discard", bind)`
> (`wave1/drs/kit.ts` Magic Blast), `EffectSpec discardDeckUntil` and `AbilityCost.discardFromDeck` /
> `discardFromDeckSlot` (`discardTopOfDeckCost`, `dsl/abilities.ts`); none of them pushes a trigger event (searched
> `trigger-events.ts`: no deck-discard kind; `cardDiscardedFromHand` and `cardDiscardedFromPlay` are log events
> only). A card in a discard pile has no ability the engine reads (`activeIn` is `"hand"` only).

**Cards.** Jackpot! (40043): "Response: After this card is discarded from the top of your deck, shuffle it back into
your deck." Digging Deep (40060): "… add it to your hand." White Fox (40057): "… put her into play under your
control." The Painted Lady (40045): "Response: After you discard a card from the top of your deck, attach that card
facedown here (to a maximum of 3)."

**Rules.** RRG "Player Deck" (p. 33: the deck resets the moment it is empty); MC40 p. 21: Jackpot! as the deck's last
card: "Player decks reset as soon as they are empty, so Domino's deck is reset with Jackpot shuffled into it."
April 30, 2026 - Ruling 4, answer 1: Digging Deep's Response is the player's choice, and a card it took "does not
count" for the effect that discarded it.

**Plan.**

- **`TriggerEvent cardDiscardedFromDeck { instanceId, playerId, fromTop: true, sourceInstanceId }`**, one per card,
  in discard order, pushed by all three discarding paths, and only when an ability listens (the `heard` gate
  `cardBeingPlayed` uses), so the hundreds of existing mills cost nothing. Response timing only.
- **`activeIn: "discard"`**: a triggered ability read from its own card while that card is in its owner's discard
  pile, offered to the owner, the way `activeIn: "hand"` reads "After this card enters your hand" (wave 4 §3.13).
  Pattern `on.thisDiscardedFromYourDeck()`.
- `on.youDiscardFromYourDeck()` for The Painted Lady, with the card as `eventTarget`.
- Several responses to one discard (the card's own and The Painted Lady's): the player orders them; the first to move
  the card leaves the other with nothing to act on, and it is not offered.
- Which discards count is §4.2 Q31; what the discarding ability still counts after a response moved the card is
  Q32; the last-card case is Q33.
- Log `cardDiscardedFromDeck { playerId, instanceId, by }` (new: a mill is today visible only as `cardsMoved`).

**Composes with:** Age of Apocalypse mission attempts (a later wave), which the ruling is about.

### 3.56 Resource icons on cards discarded from a deck; an icon counted twice

> **Status: partial.** Counting exists: `moveCards(…, bind)` reports `<bind>.physical`, `.mental`, `.energy`,
> `.wild` (`resolve/apply-effect.ts`, the `milled` helper in `wave1/drs/kit.ts`); `ValueSpec totalPrintedResources {
cards, types? }` reads whatever a ref names, including the slot `discardTopOfDeckCost(n, slot)` binds. Nothing
> changes how many times an icon counts.

**Cards.** Domino (40037a): "When counting resources on cards discarded from the top of your deck, count each printed
[wild] icon twice." Read by Diamondback, Outlaw, A Good Workout, Luck Be a Lady, Right Place, Right Time, Domino's
Pistol, Probability Field, Feral and Sharpshooter (all "for each resource icon discarded this way").

**Rules.** MC40 p. 21: "each [wild] discarded this way is treated as two [wild] icons … Outlaw has one printed [wild]
resource, which Domino's ability says to count twice, so Andrew resolves the effect on Luck Be a Lady for the [wild]
icon twice."

**Plan.** **`RuleSpec deckDiscardIconCount { player, resource: "wild", times: 2 }`**, a constant on the hero face
(so it is off in alter-ego form and under Memories of Armageddon). The two readers apply it: the `<bind>.<type>`
totals of a `moveCards` whose source was the top of that player's deck, and `totalPrintedResources` over a slot
bound by a deck discard (the slot records `fromDeckOf: playerId`). It is a count, not a change of the card: a type
test ("If that card's printed resource has …", Magic Blast) and resources generated when the card is spent are
untouched. Jackpot! counts three (energy, mental, physical), Energy / Genius / Strength two, Digging Deep and The
Power of the Mind as printed. Luck Be a Lady resolves one effect per counted icon, the wild choice once per counted
wild.

### 3.57 Swapping a hand card with the top of the deck or discard pile

> **Status: exists (verify).** `EffectSpec swapCards { a, b }` (wave 6 §3.47, `resolve/swap-cards.ts`): "Two
> out-of-play cards just exchange places"; a swap with nothing on one side is refused (`swapRefused`; RRG "'Swap'",
> p. 42: "A swap cannot be completed if there is not a component in both locations").

Domino (40037a): "Action: Choose a card in your hand. Swap that card with the top card of your deck. (Limit once per
round.)" Neena Thurman (40037b): the same with "the top card of your discard pile". `chooseCards` from hand, then
`swapCards(chosen, zone(deck | discard, top 1))`. **Verify:** the hand card lands on **top** of the deck or discard
pile; the deck card enters the hand without being a "draw"
(no "after you draw" trigger) and it does fire `cardEntersHand`; an empty discard pile makes Neena's action
unavailable; neither card is "discarded" (no §3.55 event). Each face has its own once-per-round limit (two abilities).

### 3.58 Facedown cards attached to a support, to a maximum

> **Status: exists (verify).** `attachCard(…, { facedown: true })` and `countOf({ host: self, facedown: true })`
> (Spider-Man Noir 31015, `wave5/spdr/allies.ts`: "attach that treachery facedown here (to a maximum of 3)"; George
> Stacy 27007).

The Painted Lady (40045): the response of §3.55 with the condition `count < 3`, then "Alter-Ego Action: Exhaust The
Painted Lady → add 1 card attached here to your hand" (`chooseCards` among the attachments, `moveCards` to hand; the
owner may look at their own facedown cards). The attached cards are facedown player cards: no type, traits or
abilities, discarded to their owner's discard pile when the support leaves play, never counted as upgrades.
**Verify:** a facedown **player** card as an attachment on a support (Noir's are encounter cards on an ally).

### 3.59 "When you make a ranged attack"

> **Status: missing.** The `attack` trigger event carries `ranged` (`trigger-events.ts` ~line 237, "Stamped when the
> attack pushes this event"), from the attacker's keyword or a `RuleSpec attackKeywords` grant; no `EventPattern`
> filter reads it.

Sharpshooter (40064): "Max 1 per player. Hero Interrupt: When you make a ranged attack, discard the top card of your
deck → this attack deals 1 additional damage for each resource icon discarded this way." **Plan:** `on.attacks(you,
{ ranged: true })`, an `eventIs` test on the stamped flag, with wave 6 §3.29's additional damage for a player attack
in progress. Plasma Rifle, Domino's Pistol and Sidearm grant ranged through `attackKeywords` (`via` the upgrade,
`attacker` the host), so the flag is set when the attack is declared.

### 3.60 An enemy that cancels events as they are played; bans scoped to one player

> **Status: exists (verify).** `cancelTriggeringEvent` on `cardBeingPlayed` sets the play frame's `effectsCancelled`
> (`resolve/apply-effect.ts`, `stack.ts`; Counterspell, `drs`): "the card is still considered played, and it is
> discarded". Villainous is `resolve/enemy-activation.ts`. `threatCannotBeRemoved.player` and `cannotTakeDamage {
target, fromSource }` exist.

- **Stryfe (40032)**, villainous: "Forced Interrupt: When a player plays a PSIONIC event, cancel the effects of that
  event and deal 1 damage to Stryfe." A forced interrupt on an encounter card hearing any player's play, trait read
  with granted traits (§3.50). The cost stays paid; "after you play" responses (Psimitar) still happen (RRG "Cancel",
  p. 11).
- **Back to the Future (40033)**: four constants. The two threat lines are `threatCannotBeRemoved` with `player`
  (schemes other than this one for the Cable player; this one for the others). The two damage lines are
  `cannotTakeDamage` on enemies not engaged with the Cable player, and on minions engaged with them, with
  `fromSource` naming that player's cards (`controlledBy`, or `extensionOf` plus their allies). **Verify** that
  `fromSource` can express "any card of this player" for an event already out of play; if not, add `fromPlayer?:
PlayerRef`, the mirror of `threatCannotBeRemoved.player`. RRG "Engage" (p. 18) defines engagement for minions only, and the engine's
  `engagedWith` is null for a villain (`select.ts`): whether the Cable player can damage the villain is §4.2 Q36.

### 3.61 Reusable as is, pass 2a (checked against the engine unions)

**Reprints** (raw `duplicate_of_code`; the wave's `reprints.ts` aliases them, as `wave4/reprints.test.ts` shows):
Sidearm 40030 → 23035 (`wave4/warm/war-machine-pack-cards.ts`), Even the Odds 40052 → 30014 and Overwatch 40055 →
30019 (`wave5/spiderham/`), Energy / Genius / Strength 40061–40063 → Core 01088–01090 (no ability).

| Card                                                                                       | Reading                                                                                                     | Existing vocabulary                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Soldier X (40001b)                                                                         | Setup: search deck and discard pile for a player side scheme, put it into play                              | a `setup` ability: `chooseCards` over `zone(deck, discard)`, `putIntoPlay`, `shuffleDeck`; §3.1, §3.2                                              |
| Bodyslide 40002                                                                            | change form; each other player may change to that form                                                      | `changeForm(you)`, `forEachPlayer(others)` optional `changeForm { to }`; not the once-per-round change                                             |
| Mind Scan 40003, Telekinetic Blast 40005                                                   | 3 threat / 6 damage, +1 per side scheme in the victory display                                              | `scaled(victoryDisplayCount(sideScheme), { plus })`; player side schemes are `sideScheme`                                                          |
| Precognition 40004                                                                         | look at the top X encounter cards, may discard 1, reorder                                                   | `lookAt` / `chooseCards` over `encounterCards(["deck"], top X)`, `reorderCards`                                                                    |
| Graymalkin 40007                                                                           | ready after any side scheme is defeated; exhaust for [energy]                                               | `on.schemeDefeated`, a `resource` ability                                                                                                          |
| Professor 40008                                                                            | exhaust: draw 1 or search for a player side scheme                                                          | `chooseOne`, `chooseCards` by type                                                                                                                 |
| Askani'son 40009                                                                           | after you defend: exhaust, spend [energy], remove threat equal to THW                                       | `on.defends`, `removeThreat(stat thw)` labeled thwart                                                                                              |
| Plasma Rifle 40011                                                                         | 1 damage per side scheme in the victory display, max 4, ranged                                              | `min(victoryDisplayCount, 4)`, `attackKeywords { via: self }`                                                                                      |
| Telekinetic Force Field 40012                                                              | discard: prevent all damage a friendly character would take                                                 | `when.damage(friendly)`, `preventDamage()`; the form line is data (§7.1)                                                                           |
| Caliban 40014                                                                              | discard from the deck until an X-team ally, add it to hand                                                  | `discardDeckUntil { anyTrait }`, `moveCards` to hand (wave 3 Q18)                                                                                  |
| Fantomex 40015, E.V.A. 40021                                                               | fetch E.V.A.; discard it without Fantomex; exhaust for one of three                                         | search and `putIntoPlay`; a `stateCheck` discard; `chooseOne`                                                                                      |
| Sunspot 40016                                                                              | 1 damage to the villain and each minion engaged with a chosen player per [energy] spent                     | `on.youPlayThis`, `choosePlayer`, `var("paid.energy")` plus wilds spent as energy (the `paidWith` reading)                                         |
| Mission Planning 40017                                                                     | allies you control take no consequential damage this phase                                                  | `playOnlyIf(victoryDisplayCount ≥ 1)`, `applyRuleUntil` with a `ConsequentialDamageScope` rule (wave 6 §3.31)                                      |
| Call for Backup 40018, Lock and Load 40019, Build Support 40027, Superpower Training 40059 | When Defeated: each player may fetch an ally / WEAPON upgrade ≤ 3 / support ≤ 3 / identity-specific upgrade | `whenDefeated`, `forEachPlayer`, optional `chooseCards`, `putIntoPlay`; `maxPrintedCost` via §3.4; `identitySetOf`                                 |
| Establish Perimeter 40020, Take Out the Guards 40054                                       | each identity tough; each player may discard a non-ELITE minion                                             | `giveStatus`; `forEachPlayer` optional `discardFromPlay { withoutTrait }` (a discard, not a defeat)                                                |
| Uncanny X-Force 40022                                                                      | any player's control, max 1 TEAM; allies +1 THW and −1 consequential damage after thwarting a side scheme   | data `anyPlayerControl`, `maxWithTrait`; `gets`; a `ConsequentialDamageScope { from: "thwart", if }` rule (verify it can test the thwarted scheme) |
| Mission Leader 40023                                                                       | costs 1 less for a SOLDIER; exhaust after a side scheme is defeated: each player draws 1                    | `inHand` cost reducer with `hasTrait`; `on.schemeDefeated`                                                                                         |
| Deadpool 40024                                                                             | defeated by consequential damage: heal 3 instead, add an acceleration token                                 | `on.defeated(self, { consequential: true })` forced interrupt, `replaceTriggeringEvent`                                                            |
| Deathlok 40025                                                                             | attach an upgrade costing ≤ 1 from any discard pile that he can take                                        | `chooseCards` over every discard pile, `canAttachTo` (wave 6 §3.49), `attach`                                                                      |
| Frenemies 40026                                                                            | Team-Up; 1 damage each to Cable and Deadpool; 3 threat from two different schemes                           | the `teamUp` keyword; `titled`; `excludeSlots`                                                                                                     |
| The Power of the Mind 40028                                                                | doubled while paying for a PSIONIC card                                                                     | `doublesResourcesWhilePayingFor({ trait })`                                                                                                        |
| Psimitar 40029                                                                             | after you play another PSIONIC card: exhaust, 2 damage                                                      | `on.youPlay({ trait })`, labeled attack                                                                                                            |
| Team Investigation 40053                                                                   | remove 3 per player from a side scheme                                                                      | §3.4, §3.5; `perPlayer(0, 3)`                                                                                                                      |
| Hope Summers 40204                                                                         | gains her identity's traits; fetch a SUPERPOWER card                                                        | `traitsOf` grant (wave 6 §3.50); `on.youPlayThis` search                                                                                           |
| Stryfe set: 40034, 40035, 40036                                                            | prevent damage, discard at 2 or more prevented; treacheries scaling with the victory display                | data `attachesTo ifAble` (§3.16); `preventDamage` with `eventAmount`; `victoryDisplayCount`; boost `attach` to `activatingEnemy`                   |
| Diamondback 40038                                                                          | exhaust, 1 damage to her, discard the top card: 1 damage to each enemy per icon                             | `discardTopOfDeckCost(1, slot)`, `totalPrintedResources`; resolves though the cost defeats her (MC40 p. 21)                                        |
| Outlaw 40039, Probability Field 40049                                                      | +1 ATK / +1 to the basic power per icon                                                                     | `on.attacks(self)` with `modifyStatUntil endOfAttack`; `on.basicPowerUsing`, `modifyBasicPower` (recovery included)                                |
| A Good Workout 40040, Right Place, Right Time 40042, Feral 40050, Domino's Pistol 40046    | base effect plus 1 per icon discarded                                                                       | `moveCards(topOfDeck(1), "discard", bind)` or the cost slot; §4.2 Q34 for 40040                                                                    |
| Luck Be a Lady 40041                                                                       | one effect per counted icon, by type                                                                        | the `<bind>.<type>` vars, a repeat per count, `chooseOne` for wild                                                                                 |
| Pip the Pug 40044                                                                          | a Domino or POSSE card from discard to the top of the deck                                                  | `chooseCards` with `anyOf(identitySetTitled, trait)`, `moveCards` to `deckTop`                                                                     |
| Lucky and Good 40047                                                                       | cancel a boost card's icons and ability, give another                                                       | `on` `boostCardTurnedFaceup`, `cancelBoostIcons`, `cancelBoostAbility`, `giveBoostCard` (Attacrobatics)                                            |
| Lucky Break 40048                                                                          | cancel and discard the revealed card, reveal another                                                        | `on.youRevealEncounterCard`, `cancelRevealedCard`, `revealTopOfEncounterDeck` (Black Widow)                                                        |
| Wolfsbane 40051                                                                            | name a card type, discard the top card, may take it if it matches                                           | Brainstorm's "name a card type" `chooseOne` (`wave3/gmw/market.ts`), now with player side scheme                                                   |
| Atlas Bear 40056                                                                           | look at the top card of a player deck; an event may be taken for 1 damage                                   | `choosePlayer`, `lookAt { bind }`, optional damage then `moveCards` to its owner's hand                                                            |
| The Posse 40058                                                                            | with 3 POSSE characters: heal 1 from each POSSE character and ready them                                    | `playOnlyIf(count)`, `heal`, `ready` over `each`                                                                                                   |
| Memories of Armageddon 40065                                                               | identity text box blank; exhaust in alter-ego form to discard                                               | §3.19 and Q12 (it removes both swaps and §3.56's rule)                                                                                             |
| Topaz 40066, Superpower Feedback 40069                                                     | fetch and attach the attachment; 1 damage after each identity ability                                       | `selectCards` over encounter deck, discard and set-aside, `attach`; `abilityResolved` (Black Widow), §4.2 Q35                                      |
| Not My Lucky Day 40067, Prototype 40068                                                    | each player: 1 damage or 2 threat here; luck counters as hit points                                         | `forEachPlayer` `chooseOne` (Q8); `addCounters(damage on identity)`, `gets("hp", counters)`                                                        |

### 3.62 A three-face identity whose hero faces differ only by title

> **Status: partial.** Wave 2 §3.2 landed the three-sided identity (`HeroIdentityCard.additionalHeroForms`,
> `IdentityState.heroFormIndex`, the `changeForm { to: "alterEgo" | { heroForm } }` command, one legal action per
> reachable face, `formChanged` with both face indexes; `packages/engine/src/three-sided.test.ts`). The emitted Angel
> record already has that shape. Two things assume Ant-Man: the effect `changeForm.heroForm` is `{ withTrait }` or
> `"other"` (`spec.ts`), and `changeFormTarget` (`resolve/effects-frame.ts`) sends a bare "change form" from a hero
> face to alter-ego only.

Angel and Archangel print the same traits (AERIAL, X-FORCE), so no trait names either face.

1. **"Change to Archangel form"** (Apocalyptic Influence): add `heroForm: { named: string }`, matched on
   `HeroFace.faceName`. From alter-ego or from Angel it is a change; in Archangel form the card's other branch runs.
2. **"Change form"** (Metamorphosis; Bodyslide 40002 when an Angel player is at the table): on an identity with more
   than one hero face the player chooses among **every face other than the one showing** (Ant-Man insert, quoted in
   wave 2 §1.1: "from one hero form to the other hero form" is a change of form; the Angel insert applies "the
   standard rules for changing form"). Today only a change from alter-ego asks. Make the bare effect ask from a hero
   face too, and audit `wave2/ant` and `wave2/wsp` for scripts that rely on bare `changeForm` meaning "to alter-ego"
   (they should say `to: "alterEgo"`).
3. **"If you are Angel / Archangel / Warren Worthington III"**: `Predicate faceNamed { of: your identity, name }`
   exists and reads the face showing (`currentName`, `query.ts`); its only builder is local to
   `wave1/gob/local.ts`. Move it to `dsl/values.ts`. "In Archangel form" (42024) is the same predicate.
4. A voluntary change between the two hero faces uses the once-per-round change (`actions.ts changeForm`, wave 2
   §4.6 as landed). Not asked again.
5. "Other characters with the title Angel or Archangel and the subtitle Warren Worthington III cannot enter play"
   (Angel insert) is RRG "Unique Icon" (pp. 45–46) with the alter-ego title as the match. **Verify** the Angel ally
   (41003, in Psylocke's deck) is refused in any of the three forms.

Responses on the faces: "After you play an AERIAL event" is read when the event has resolved, so the face then
showing answers. Metamorphosis played as Angel into Archangel form offers Angel of Death (2 damage, its printed
cost), not Angel of Life (§4.2 Q42).

### 3.63 A scheme icon printed on one identity face, or on an obligation in play

> **Status: partial.** `BaseCard.schemeIcons` and `nonSchemeIcons` (`rules.ts`) count hazard, crisis and
> acceleration icons on any card in play that is not a scheme. `HeroFace` has no icon field, and `showingIconsOn`
> reads `card.schemeIcons` or a flip side's, never an identity face. No emitted `cards.ts` under
> `packages/content/src/data` contains `schemeIcons` at all (grep, 2026-10-04): the normalizer emits scheme icons
> only for main and side schemes.

Archangel prints an acceleration icon in his text box (scan 42001c; raw `scheme_acceleration: 1`; the Angel insert).
RRG "Acceleration Icon" (p. 5): 1 more threat in step one of the villain phase for each "in play". **Plan:**
`HeroFace.schemeIcons?`, read in `showingIconsOn` through `identityFace`, so the icon counts only while the
Archangel face is up. Apocalyptic Influence prints a hazard icon (scan 42024; raw `scheme_hazard: 1`), which counts
while the obligation sits in its player's play area (§3.70; RRG "Hazard Icon", p. 21): the existing field, once the
data carries it.

### 3.64 A double-sided permanent upgrade its controller flips

> **Status: partial.** The pieces were built with this card in view: `resource(generates, options, ...effects)`
> (`dsl/abilities.ts`, whose doc names Psi-Knife's "You may flip this card"); `RuleSpec attackKeywords { basicOnly }`
> (doc names Psi-Katana); `characterIgnores` (doc names Psionic Training); permanent cards set aside before setup
> step 1 and put into play by a Setup ability (`setup.ts`, wave 6 §3.74); `flipCard` and `currentName` over
> `flipSide`; `basicPowerUsing`, pushed above the power's own event so an interrupt resolves before the value is
> read, with piercing "stamped when the attack pushes its damage" (`trigger-events.ts`). Missing: a "cannot flip"
> rule, and the restricted check after a flip.

- **Setup.** Betsy Braddock's Setup puts both copies into play, Psi-Knife side up. They are permanent: never in the
  deck, not counted toward its size (RRG "Permanent", p. 32), so the starter list's 42 cards are a 40-card deck.
- **Psi-Energy Control** (41001a, a star on THW, ATK and DEF): `on.basicPowerUsing` with power attack, thwart or
  defense, optional, the player choosing one PSI-ENERGY upgrade she controls and `flipCard`. The flip happens before
  the power's value is read: Knife to Katana on a basic attack gives that attack +1 ATK and piercing; Katana to
  Knife takes them away. **Verify** `flipCard` on a player upgrade keeps its exhausted state and counters (RRG
  "Flip", p. 20: same card type), and that the flip side's abilities, keywords and `gets` replace the front's.
- **Counting faces.** "For each Psi-Knife you control" is `countOf(query("upgrade", { name, controlledBy: you }))`;
  `TargetQuery.name` reads the showing face. RRG "'For Each'" (p. 20): with "choose" each iteration is its own
  instance (Flurry of Blades is the entry's example); without it, one instance (Mental Detection's threat).
- **"You cannot flip your Psi-Katana upgrades"** (Body Swapped): add `RuleSpec cannotFlip { target, while? }`, read
  by `flipCard` and by the offer of any optional flip (the Katana's "You may flip", Psi-Energy Control's choice).
  `cannotChangeForm` is the nearest sibling and does not cover a card flip.
- **Restricted after a flip.** The Katana side is restricted; `actions.ts` checks the limit when a card is played
  and when one enters play. A flip that takes a player past two must be checked too, and a permanent card is never
  the one discarded (RRG p. 32: "not valid targets for card effects that would cause the permanent card to leave
  play"). §4.2 Q38.
- **Body Swapped's When Revealed**: `flipCard` each PSI-ENERGY upgrade showing Psi-Knife, then `exhaust` each
  (§4.2 Q43).

### 3.65 "The number of [type] resources on cards you control"

> **Status: exists (verify).** `ValueSpec totalPrintedResources { cards }` (`spec.ts`) sums printed icons over a
> ref, with `<bind>.<type>` per type.

Chimera (41026) and Telekinetic Dragon (41029) count printed [mental] icons. **Verify** that the value can be asked
for one type over "cards you control in play", and that a flipped upgrade reports its showing face's icons
(Psi-Knife prints [mental], Psi-Katana [physical]; the flip side's icons are missing from the data, §7.2). Which
cards count is §4.2 Q39. Chimera's bonus is a stat modifier for the activation, from a forced interrupt on `enemyActivating`.

### 3.66 A player's attack redirected to a friendly character

> **Status: missing.** `retargetAttack { character }` (`spec.ts`) moves an **enemy** attack in progress (Crossfire).
> Nothing moves a player's attack.

Psionic Illusion (41028): "Forced Interrupt: When you attack an enemy, name a resource type, then discard the top
card of your deck. If that card does not have a resource of the named type, change the target of this attack to a
friendly character of your choice and discard this card." **Plan:** widen `retargetAttack` to the innermost player
`attack` event: same attacker, damage, keywords and source, new target; consequential damage and "after you attack"
unchanged. Naming a type is a four-option `chooseOne` (the Wolfsbane shape, §3.61); the test is
`printedResource` on the discarded card (a wild is its own type, §4.2 Q40). The discard is from the top of the deck,
so §3.55's responses see it.

### 3.67 An attack whose boost icons and Boost abilities are ignored

> **Status: missing.** `cancelBoostIcons` / `cancelBoostAbility` (`spec.ts`) cancel one boost card as it is turned
> faceup (Lucky and Good, §3.61); `enemyAttack.boost: false` deals none. Nothing ignores every boost card of an
> attack already under way.

Aerial Agility (42004), as Angel: "ignore each boost icon and each 'Boost' ability for this attack." **Plan:** a
rule applied until the end of the attack (`applyRuleUntil endOfAttack`): each boost card of that activation is
still turned faceup and discarded, adds 0, and its star ability does not resolve (RRG "Ignore", p. 23: the icon or
ability is treated "as not being in effect or present"). Nothing is canceled, so abilities that answer a canceled
boost card do not trigger. As Archangel: `giveStatus tough` and
`gainsKeyword retaliate 1` until the end of the attack, both existing. Either way the card is "(defense)": Angel
becomes the defender if there is none (RRG "Defense", p. 15), whoever was attacked (§4.2 Q41).

### 3.68 A played event returned to hand after it resolves

> **Status: partial.** `on.youSpendThis({ toPlay })` (`dsl/abilities.ts`, wave 2 §12) is "After you spend this card
> to play X", and the card paid for is slot `paidFor`. No effect changes where a played event goes when it leaves
> the stack.

Avian Anatomy (42008): the response marks the event being paid for; when its effects have resolved it goes to its
owner's hand instead of the discard pile. **Plan:** a destination on the play frame (`afterResolving: "hand"`), set
by an effect naming `paidFor`, read where an event is discarded after resolving. The event was still played: Angel
of Life or Angel of Death answers it, and so does The Power of Flight's doubling. Two copies spent on one event
return it once.

### 3.69 "An attack that has a keyword"; "Max 1 per attack"

> **Status: missing.** Extends §3.59 (missing): `attackKeywordsOf` (`keywords.ts`) computes an attack's keywords
> from the attacker, the attack and `attackKeywords` rules, but no `EventPattern` filter or `Predicate` reads it.
> No "per attack" limit on a played card was found (`maxDamageTakenPerAttack` is a damage cap).

Directed Force (41019): "When your hero makes an attack that has a keyword (overkill, piercing, or ranged), that
attack deals 2 additional damage. (Max 1 per attack.)" **Plan:** one filter for both rows, `on.attacks(you, { has:
AttackKeyword[] })`, true when `attackKeywordsOf` for the triggering attack includes any listed keyword (§3.59 is
`{ has: ["ranged"] }`); the additional damage is wave 6 §3.29's. "Max 1 per attack" is a play limit scoped to the
attack frame. Psylocke's basic attack with a Psi-Katana qualifies, and with two Katanas still gets one.

### 3.70 An obligation that stays in play until its own Action discards it

> **Status: exists (verify).** Permanently Phased (`mut_gen` 32055) is an obligation in its player's play area with
> a constant ("you cannot defend", `cannotDefend` read with the holder as "you", wave 6 §3.77). Memories of
> Armageddon (§3.19) is the same shape in this wave.

Body Swapped (41025) and Apocalyptic Influence (42024) have no "choose" at reveal: the When Revealed resolves, the
card stays in its player's play area, and only that player may use its Alter-Ego Action (RRG "Obligation", p. 30).
Costs: `discardFromHand` of 1 PSIONIC card; `dealEncounterCard(firstPlayer)` as a cost (the existing
`dealEncounterCardsCost` deals to the paying player: **verify** or add a `player`). While in play Body Swapped's
constant is §3.64's `cannotFlip` and Apocalyptic Influence shows its hazard icon (§3.63).

### 3.71 An either-trait identity play restriction

> **Status: exists (compose).** `constant(playOnlyIf(anyOf(youHaveTrait(A), youHaveTrait(B))))`: Moon Girl
> (`wave5/nova/support-upgrades-allies.ts`, 28018), Breaking and Entering (`wave6/gambit/gambit/events.ts`, 37015).
> `parse-text.ts` leaves a two-trait sentence unparsed on purpose, so it reaches the script as a constant ability.

Elixir (42011), "Play only if your identity has the X-FORCE or X-MEN trait", is scripted the same way as
`42011.elixir-constant`. `playOnlyIf` is checked by `playRestrictionFault` on every route (a play command,
`legalActions`, a play from an effect), and traits are read with grants, so X-Force Recruit on the identity counts.

**Data should carry it too.** This is the fifth card of the shape (28018, 37015, two in `magneto`, 42011), and a
restriction that lives only in a script fails open: if the script is missing, anyone can play the card, where the
single-trait field is validated data that `actions.ts` enforces by itself. **Proposed:**
`PlayRestrictions.requiresIdentityAnyTrait?: readonly Trait[]`, parsed from "the A or B trait", enforced beside
`requiresIdentityTrait`. Until it lands the scripted constant is the enforcement, and stays harmless afterward.

### 3.72 Reusable as is, pass 2b (checked against the engine unions)

**Reprints** (raw `duplicate_of_code`): Concussive Blow 41014 → 05031, The Power of the Mind 41021 → 40028 (§3.61),
Ever Vigilant 42015 → 17030, Soaring Hearts 42021 → 41020. Telepathy 41024 has no `duplicate_of_code`: it is a new
card here (the encounter attachment Telepathy 40159 is a different card), and Telekinesis 41033 is its sibling.

| Card                                                                                                | Reading                                                                                                                                  | Existing vocabulary                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Betsy Braddock 41001b                                                                               | Setup: both PSI-ENERGY upgrades into play, Knife side; exhaust one to shuffle a PSIONIC card from discard into the deck                  | a `setup` ability over the set-aside permanents (wave 6 §3.74); `exhaust` cost with `chooseCards`, `moveCards`, `shuffleDeck`                                                                                                                    |
| Angel 41003, Psylocke 42002                                                                         | ready your identity when played; after she attacks, heal her (Angel) or ready your hero (Archangel)                                      | `on.youPlayThis`, `ready`; `on.attacks(self)` with `faceNamed` branches (§3.62)                                                                                                                                                                  |
| Flurry of Blades 41004, Mental Detection 41005, Psionic Redirect 41006, Telepathic Suggestion 41007 | a base effect, then one effect per Psi-Knife and one per Psi-Katana                                                                      | labeled attack / thwart / defense; `countOf` by face name (§3.64) with a repeat per count; `preventDamage`; `cancelWhenRevealed` on `on.youRevealEncounterCard`                                                                                  |
| Training Regimen 41008                                                                              | search the deck for a SKILL card; in hero form discard 1                                                                                 | `chooseCards` by trait, `shuffleDeck`, `ifThen(isHero(), …)` with a hand discard                                                                                                                                                                 |
| Martial Arts 41009, Psionic 41010, Weapons Training 41011                                           | a constant, and a response that discards the card                                                                                        | `gets("def", 1)`; `characterIgnores [guard, patrol]`; `gainsKeyword retaliate 1`; `on.defends` / `on.thwarts` / `on.attacks` with a discard-self cost                                                                                            |
| Captain Britain 41012                                                                               | 1 less consequential damage after thwarting a side scheme or attacking a minion                                                          | a `ConsequentialDamageScope` rule (wave 6 §3.31); verify it can test the thwarted scheme and the attacked enemy (as Uncanny X-Force, §3.61)                                                                                                      |
| Cypher 41013, Upside the Head 41015, Float Like a Butterfly 41017                                   | after or when an attack on a confused enemy                                                                                              | `on.attacks` with a `hasStatus` test and `<bind>.damaged`; `ifThen(confused, stun, confuse)` read before the status is given; wave 6 §3.29's additional damage                                                                                   |
| Lay the Trap 41016, Render Medical Aid 42017                                                        | When Defeated: 5 per player damage to the villain; each player heals a total of 5 among their characters                                 | §3.1, §3.2, Q2; `whenDefeated`, `perPlayer(0, 5)`; `forEachPlayer` with the divided heal (`dsl/divide-heal.test.ts`)                                                                                                                             |
| Pete Wisdom 41018                                                                                   | heal 1 after you resolve a treachery's When Revealed                                                                                     | `on` `encounterCardResolved` filtered to treacheries; data `requiresIdentityTrait`                                                                                                                                                               |
| Soaring Hearts 41020                                                                                | Team-Up; an identity-specific event from discard to hand; ready Angel and Psylocke                                                       | the `teamUp` keyword; `chooseCards` with `identitySetOf(you)` and type event; `ready(titled(...))`; Q37                                                                                                                                          |
| IPAC 41022, X-Bunker 41023                                                                          | deal a player a facedown encounter card, they draw 2; a MUTANT player searches the top X cards                                           | `choosePlayer`, `dealEncounterCard`, `draw`; `victoryDisplayCount(sideScheme)` as the search depth                                                                                                                                               |
| Telepathy 41024, Telekinesis 41033                                                                  | exhaust and spend [mental][mental]: remove 2 threat / deal 3 damage                                                                      | exhaust and `spendResources` costs, labeled thwart / attack; data restrictions (§7.2)                                                                                                                                                            |
| Interdimensional Plunder 41027                                                                      | 1 threat here per upgrade in play                                                                                                        | `placeThreat(countOf(query("upgrade")))`                                                                                                                                                                                                         |
| Psi-Bow Attack 41030, Psi-Flail Strike 41032                                                        | 4 damage, ranged; after you defend, 3 damage and stun                                                                                    | `attack.keywords: ["ranged"]`; `on.defends`, labeled attack, `giveStatus`                                                                                                                                                                        |
| Domino 41031                                                                                        | after her basic power, swap a hand card with the top of the deck                                                                         | `basicPowerUsed`, §3.57                                                                                                                                                                                                                          |
| Warren Worthington III 42001b, Angel 42001a, Archangel 42001c                                       | heal 1 once per round; after an AERIAL event draw 1 / deal its printed cost, once per phase                                              | `heal` with a round limit; `on.youPlay({ trait, type: event })` with a phase limit; `printedCost(eventCard)`; each ability keeps its own limit across a flip (January 26, 2026 - Ruling 6)                                                       |
| Adaptive Plumage 42003                                                                              | two Hero Actions, one per hero face                                                                                                      | two abilities, each with `faceNamed` as its condition, so only the showing face's is offered                                                                                                                                                     |
| Natural Flight 42006, Razor Dive 42007                                                              | 4 threat, ignoring crisis and patrol as Angel; 6 damage, overkill and piercing as Archangel                                              | `removeThreat { ignoreCrisis, ignorePatrol }` and `attack.keywords` under `faceNamed`                                                                                                                                                            |
| Worthington Industries 42009                                                                        | shuffle an AERIAL card from discard into the deck; draw 1 in alter-ego form                                                              | `chooseCards`, `moveCards`, `shuffleDeck`, `ifThen(isAlterEgo(), draw)`                                                                                                                                                                          |
| Techno-Organic Wings 42010                                                                          | ready your hero (Angel); the next AERIAL event from hand this phase costs 2 less (Archangel)                                             | `ready`; `reduceNextCardCost { duration: "phase", cardFilter }` (verify "from your hand")                                                                                                                                                        |
| Siryn 42012, Cannonball 42020                                                                       | stun a minion after attacking; consequential damage less the AERIAL cards in hand                                                        | `on.attacks(self)`; `modifyConsequentialDamage` with a negative `countIn(hand, trait)`                                                                                                                                                           |
| Warpath 42013                                                                                       | toughness; after he defends, play a "Hero Action" event from hand at its cost                                                            | `playFromHand` with `filter { abilityTiming }` and `costReduction: 0` (verify: the effect requires a cost mode, and a Hero Action must be playable in the villain phase this way)                                                                |
| Aerial Intervention 42014, Bombs Away 42029                                                         | exhaust an AERIAL character you control: prevent up to 3 attack damage to any character / 3 damage to the villain and a player's minions | an exhaust-a-chosen-card cost; `when.damage(anyCharacter, fromAttack)`, `preventDamage(3)`; `choosePlayer`                                                                                                                                       |
| Taunt 42016                                                                                         | the villain attacks you, only your hero may defend, draw 3                                                                               | `enemyAttack`; `cannotDefend { target: every other character, attacker }` until the end of that attack; `draw(3)` after it, also when a stun replaced the attack                                                                                 |
| Angel's Aerie 42018                                                                                 | a fatigue counter after you defend; remove them all to heal that many                                                                    | `on.defends`, `addCounters`; the `removeAllCounters` cost with its count                                                                                                                                                                         |
| Containment Strategy 42019                                                                          | on a non-permanent side scheme; after a hero defends remove 1 threat, 2 if undamaged                                                     | data `attachesTo`; §3.18's "defends and takes no damage"; a player side scheme is a side scheme                                                                                                                                                  |
| The Power of Flight 42022, Soaring Acrobatics 42023                                                 | doubled for an AERIAL card; +1 to an AERIAL character's basic power                                                                      | `doublesResourcesWhilePayingFor({ trait })`; `on.basicPowerUsing` over characters you control, `modifyBasicPower(1)`                                                                                                                             |
| Harpoon 42025, Spear Shot 42028                                                                     | +1 ATK against an AERIAL character; discard until an event, indirect damage equal to its printed cost                                    | a forced interrupt on `enemyAttack` once the defender is known (RRG p. 15: a defending ally is the target) with a stat bonus until the end of the attack (verify the timing); `discardDeckUntil`, `printedCost`, `dealIndirectDamage`; `surge()` |
| Hook, Line, and Sinker 42026                                                                        | BRUTE enemies' attacks deal indirect damage; a character that takes indirect damage is exhausted                                         | `attacksDealIndirectDamage { attacker }` (wave 3 §3.16); a forced response on damage flagged indirect                                                                                                                                            |
| Harpoon's Harpoon 42027                                                                             | attach to Harpoon, fetching and revealing him; 2 indirect damage after he attacks you                                                    | data `attachesTo namedCard` and `statModifiers`; the search of encounter deck and discard pile, as Armadillo's attachment (`nova`), here revealing him                                                                                           |
| Eyes in the Sky 42030, Flying Formation 42031, X-Force Recruit 42032                                | cancel a non-ELITE minion's reveal and reveal another; ready up to 3 AERIAL characters; +1 hit point and the X-FORCE trait               | Lucky Break's `cancelRevealedCard` and reveal of another card (§3.61); §3.5, `chooseCards upTo 3`, `ready`; `gets("hp", 1)` and a trait grant (wave 6 §3.50)                                                                                     |

### 3.73 'Pool as a deck's chosen aspect

> **Status: exists.** `CoreAspect` includes `"pool"` (`packages/content/src/schema/aspects.ts`); `CHOOSABLE_ASPECTS`
> in `packages/engine/src/deck.ts` lists five, and `validateDeck`'s `aspect_choice` and `aspect_restriction` checks
> read it; `validation.ts` accepts `'Pool` as a printed aspect; the glossary's aspect entry names it. Every 'Pool
> card is emitted with `aspect: "pool"`.

**Rules.** RRG 1.8 "Aspect Card" (p. 8) and "Classifications" (p. 12), with the self-disagreement recorded in §0; the
Deadpool insert ("counts as an aspect for all gameplay purposes"); its Adam Warlock FAQ: 'Pool "can be used in place
of any of the other four aspects", and a hero "who can include cards from more than one aspect … can choose the
'Pool aspect as one of those aspects".

Nothing to build. A 'Pool card is an aspect card everywhere a card asks for one (Plot Convenience's "1 aspect
card", `distinctAspectsOf`, Finesse-style "for an aspect card" resources), and "a 'Pool ally" (Deadpool Corps Ship)
and "'Pool (pink) cards" (Dreadful Deeds) are the classification `TargetQuery.aspect: "pool"`, not a trait. Tests
are listed in §7.3 (deckbuilding).

### 3.74 An encounter set included only when a player chose an aspect

> **Status: missing.** `EncounterSet` (`packages/content/src/schema/sets.ts`) has `extraModular`, `classification`,
> `nemesisOfIdentityId` and no conditional inclusion; the emitted `dreadpool` set is a bare `{ id, name, packCodes }`.
> `PlayerSetup.aspects` (`packages/engine/src/setup.ts`) is documented as "only read when `requireLegalDecks` is
> set". The set-aside half exists: §3.29's named set-aside set.

**Cards.** Crisis of Infinite Deadpools (44037): "When Revealed: Reveal the set-aside Dreadpool minion and Dreadful
Deeds side scheme. Shuffle the rest of the set-aside Dreadpool encounter set into the encounter deck. Remove this
card from the game." The set is seven cards: 44037, Dreadpool 44038, Dreadful Deeds 44039, Anti-Regeneration Ray
44040, 'Pool-ized 44041 ×2, Metacidal Tendencies 44042.

**Rules.** Deadpool insert (quoted in §0): one copy of 44037 is shuffled into the encounter deck "when setting up a
game in which at least one player is using the 'Pool aspect", the rest set aside. RRG 1.8 FAQ, Crisis of Infinite
Deadpools (#37), p. 64: not included when an ability merely lets a player include 'Pool cards from outside their
chosen aspect; "only included if at least one player in the game chooses the 'Pool aspect as (one of) their chosen
aspect(s)".

**Schema (the field asked for).** On `EncounterSet`:

```ts
/** A set no one picks: it is in every game in which `when` holds, on top of the scenario's own sets. */
readonly autoIncluded?: {
  readonly when: { readonly kind: "aspectChosen"; readonly aspect: CoreAspect };
  /** The cards shuffled into the encounter deck at setup; the rest of the set starts set aside. */
  readonly shuffledIn: readonly CardId[];
};
```

`dreadpool` gets `autoIncluded: { when: { kind: "aspectChosen", aspect: "pool" }, shuffledIn: ["44037"] }`. An
`autoIncluded` set is never a modular choice, a random pick or a `modularSetPool` member and never counts toward
`modularSetCount` (the `extraModular` treatment, enforced by the same validation), and `validateScenario` refuses a
scenario that lists one (§4.2 Q44).

**Plan (engine).** In the step that builds the encounter deck (RRG Appendix II), for each `autoIncluded` set of the
card pool whose `when` holds: the `shuffledIn` cards join the encounter deck and the rest go to the set-aside area
under the set's id. "Chose" is the declared choice, `PlayerSetup.aspects` and the campaign seat's `aspects`, never
inferred from the cards in the deck (the FAQ); so `aspects` becomes a field setup always reads, and a seat that
supplies none has chosen none. One copy whatever the number of 'Pool players. Scenarios with their own setup
(campaign games, a second encounter deck) add it to the encounter deck the first player's game area draws from. Log
`encounterSetAutoIncluded { setId, because }`.

Crisis itself composes: `revealEncounterCard` on the two named set-aside cards, §3.29's shuffle of the remainder,
`moveCards(self, "removedFromGame")`. Discarded as a boost card, or canceled by Metaknowledge ("cancel all of its
effects and discard it"), it goes to the encounter discard pile and returns with the next reshuffle; the set stays
aside until it is revealed.

### 3.75 Linked cards set aside at setup

> **Status: partial.** The keyword is data (`KeywordInstance linked { cardTitle }`, emitted on 43034–43037) and
> `validateDeck` refuses a linked card (`linked_card`, citing p. 27 and the August 3, 2026 ruling); the glossary
> entry is marked `box: "later"`. Nothing in `setup.ts` sets linked cards aside (searched "linked" across
> `packages/engine/src`: only `deck.ts`), and no card scripted so far carries the keyword.

**Rules.** RRG 1.8 "Linked (Card Title)" (p. 27): "set aside at the start of the game if any deck includes the card
that brings the linked cards into play"; "The number of linked cards set aside during setup is equal to the number
of those cards included in the product from which the linked card came"; "If multiple decks contain the same card
named on one or more linked cards, set aside the appropriate number of cards for each deck that contains the named
card"; "When a player takes control of a card with the linked keyword, that player becomes the owner of that card."
August 3, 2026 - Ruling 4, answer 3: not even a campaign reward puts one in a deck.

**Plan.**

- **Setup.** For each deck, for each distinct title in it that some linked card of the card pool names, create that
  card's `quantityInSet` copies in the set-aside area. Found by a scan of the pool for `linked` keywords, so a later
  pack's linked cards (Captain America's Shield) need nothing more. Log `linkedCardsSetAside { forPlayer, cardIds }`.
- **Owner.** Set aside with no owner; whoever takes control becomes the owner (`CardInstance.owner` written when a
  linked card enters play under a player's control). From then on it is that player's card: discarded, it goes to
  their discard pile and later into their deck, where its printed cost (2) is what replaying it costs.
- **Specialized Training** (43021, a basic player side scheme, 5 per player threat): `whenDefeated`, `forEachPlayer`
  in player order with the condition "controls no SPECIALIZATION upgrade", `chooseCards` among the set-aside cards
  with the trait, `putIntoPlay` under that player's control. Each Specialist is unique, so with two decks' sets
  aside a title already in play cannot be chosen; a player with nothing left to choose gets nothing.
- **The four Specialists** compose: `gets("atk" | "def" | "thw", 1)` on your hero and "Hero Response: After your
  hero performs a basic attack / defense / thwart, exhaust this card → draw 1 card" (`on.basicPowerUsed` with the
  power). Front Line Specialist (43036, erratum RRG p. 69, already in the data's `current` text): "Your **identity**
  gets +4 hit points", so the bonus holds in alter-ego form, and its Response reads `on.damage(yourIdentity, {
fromAttack: enemy })`.

Needs §3.1 and §3.2 for the scheme itself.

### 3.76 Acceleration tokens on the main scheme as a number

> **Status: partial.** The tokens are state (`MainSchemeState.accelerationTokens`), placed by `addAccelerationToken`
> (`dsl/effects.ts`), removed by `removeAccelerationToken`, heard by `on.accelerationTokenPlaced`, redirected by
> `RuleSpec accelerationTokenDestination`, and added to step one's threat in `villain/phase.ts`. No `ValueSpec`
> reads the count (the `ValueSpec` union in `spec.ts` has `counters`, `threat`, `damage`; none for these tokens).

**Cards.** Cable (44002): "+1 THW and +1 ATK for each acceleration token on the main scheme (to a maximum of +3 THW
and +3 ATK)". Exhausting Personality (44003). Montage (44007, §3.80). It Ain't Over... (44011): "Increase the target
threat value of attached scheme by 2 for each acceleration token on it." Deadpool's own interrupt places them
(§3.78), and so does Metacidal Tendencies (44042).

**Rules.** RRG 1.8 "Acceleration Token" (p. 5): tokens on the main scheme "cannot be removed from play" and are not
discarded "when a main scheme card leaves play"; "Acceleration tokens are not considered acceleration icons, and
vice versa" (the Deadpool insert's first FAQ says the same). So these four cards count tokens only, and §3.77's
cards count icons only.

**Plan.** `ValueSpec accelerationTokens { on: TargetRef }`, DSL `accelerationTokensOn(theMainScheme)`: the tokens
on that main scheme, not those an `accelerationTokenDestination` rule sent to another card ("on the main scheme").
Cable is `gets("thw" | "atk", min(tokens, 3))`; It Ain't Over... is the existing main-scheme value modifier
(`SchemeValueName "targetThreat"`, `spec.ts` ~line 896, "Increase the target threat … by 4") with `product(2,
tokens)`, on a player upgrade whose data host is `{ kind: "mainScheme" }` (verify: a player card attached to a main
scheme stage is discarded when that stage leaves play, and the tokens stay).

Exhausting Personality is a `choose` between two cost-then-effect branches: `addAccelerationToken` then stun and
confuse the villain; or exhaust one ready identity of any player (June 2, 2026 - Ruling 5), who then draws 1 card
per token. Each branch is offered only while its cost can be paid: the second needs a ready identity.

### 3.77 The four encounter icons counted across every card in play

> **Status: partial.** `iconsInPlay(state, deps, icon, area)` and `iconsOn` (`packages/engine/src/rules.ts`) already
> count printed and granted crisis, acceleration and hazard icons on schemes and on any other card through
> `BaseCard.schemeIcons`, and amplify through `amplifyIcons` / `printedAmplifyOn`. Three gaps: no `ValueSpec` or
> `Predicate` exposes the count to a script; the data drops the icons printed on seven 'Pool cards; a player side
> scheme shows none (§3.1 gap 1).

**Cards.** "for each [crisis], [acceleration], [amplify], and [hazard] in play": Barely a Scratch (44017, prevent 1
damage each), Da Bomb (44019, 1 damage to each enemy and hero each), 'Pool Inspection (44023, 1 threat from each
scheme each), Bazooka (44052, 1 damage each), Laser Swords (44055, +1 ATK each, to +4). "I Got This" (44021) tests
each icon type separately; the Deadpool insert: it "only checks that at least one such icon is in play".

**The 'Pool cards print these icons themselves**, and they work like any printed icon while the card is in play
(the insert's "nasty icons"): Dogpool, Kidpool and Bob, Agent of Hydra an acceleration icon (1 more threat in step
one); Headpool, Lady Deadpool and the scheme Dreadful Deeds an amplify icon; Negasonic Teenage Warhead and Pandapool
a hazard icon (one more encounter card dealt); Ambush and Distraction a crisis icon (no thwarting the main scheme);
Live Dangerously all four. `iconsInPlay` already treats a non-scheme card's `schemeIcons` this way; the data fix is
in §7.3.

**Plan.**

- `ValueSpec iconsInPlay { icons?: readonly CardIcon[] }`: the sum of `iconsInPlay` over the listed icon types (all
  four when absent), amplify included. DSL `encounterIconsInPlay()`; "I Got This" is four `ifThen(valueAtLeast(
encounterIconsInPlay(["crisis"]), 1), …)` lines in printed order, each resolved if able.
- Acceleration **tokens** are never counted (§3.76). A blanked or facedown card shows none (`iconsBlankedOn`,
  existing, which reads a blank text box as hiding the card's icons): a 'Pool ally under 'Pool-ized, "a minion with a
  blank text box", stops showing its icon.
- "In play" is every game area (the default `area: null`).
- Read when the effect resolves: Bazooka's own icons do not exist (it prints none) and it is discarded as the cost.

### 3.78 A player's defeat replaced

> **Status: exists (verify).** An identity's defeat is a `characterDefeated` event heard before elimination
> (`resolve/defeat.ts`: "Reaching here means no interrupt replaced the defeat"), and three scripted cards replace
> it with `instead(setRemainingHitPoints(n, …), …)`: Drax's kit (`wave3/drax/drax-kit.ts` line 180:
> `instead(setRemainingHitPoints(4, host), changeForm(you, "alterEgo"), moveCards(cards(self), "removedFromGame"))`,
> the same three-step shape as both cards here), Wolverine's (`wave6/wolv/wolverine/support-upgrades-allies.ts`)
> and Captain America's Helmet (`wave1/cap/kit.ts`, "set his hit point dial to 1").

**Cards.** Deadpool (44001a): "_The Regeneratin' Degenerate_ — Forced Interrupt: When you would be defeated, instead
set your hit point dial to 1, change to alter-ego form, and add 1 acceleration token to the main scheme." Git Gud
(44028, unique): "Forced Interrupt: When a player would be defeated, they set their hit point dial to 1 and change
to alter-ego form instead. Remove this card from the game."

**Script.** Deadpool: a forced interrupt on `when.defeated(yourIdentity)` printed on the hero face:
`instead(setRemainingHitPoints(1, yourIdentity), changeForm(you, "alterEgo"), addAccelerationToken())`. Git Gud:
the same on any player's identity, with that player as the one whose dial and form change, then
`moveCards(cards(self), "removedFromGame")`.

**Verify, one test each.**

1. The ability is on the hero face only: Wade Wilson at 0 hit points is eliminated. Blanked (Tabula Rasa 16, or
   Anti-Regeneration Ray for the length of an attack), Deadpool is eliminated too.
2. The change of form is an effect, not the player's once-per-round change (RRG "Form, Change Form", p. 21), and
   "after you change form" abilities answer it.
3. It can happen any number of times a game, each adding a token; nothing here removes one (RRG p. 5).
4. With Git Gud in play and Deadpool defeated, both forced interrupts are pending on one defeat: the first to
   resolve replaces it and the other no longer has a defeat to answer. The first player orders simultaneous forced
   abilities (existing window rule); choosing Deadpool's keeps Git Gud in play.
5. Damage past zero is ignored: the dial is set to 1 whatever the excess.
6. A cost that deals the last damage (§3.79, X-23 has none here) still counts as paid.

Cannot change form: §4.2 Q45.

### 3.79 A damage cost whose amount the payer chooses

> **Status: missing.** `AbilityCost.damageSelf` is `number | ValueSpec` (`packages/engine/src/abilities.ts`, settled
> in `cost-damage.ts`), read "with the picks above bound"; nothing lets the payer pick the amount. `EffectSpec
chooseNumber` (wave 6 §3.69) and its `chooseNumber` choice kind exist for effects.

**Cards.** Maximum Effort (44004): "Hero Action (attack): Take any amount of damage up to your remaining hit points
→ deal an equal amount of damage to an enemy." "Yoo-Hoo!" (44006): the same, as a thwart: "remove an equal amount of
threat from a scheme."

**Rules.** RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that
damage was taken"; the Focused Rage FAQ (p. 57), which `cost-damage.ts` already follows: a cost a tough status card
would prevent cannot be paid.

**Plan.** `AbilityCost.damageSelf` gains a third form, `{ choose: { min: ValueSpec; max: ValueSpec } }`: paying the
cost opens the existing `chooseNumber` choice, the pick is recorded as `cost.damageSelf` exactly as the `ValueSpec`
form records it, and the rest of `cost-damage.ts` is unchanged (the tough check, "cannot take damage", the
unpaid-cost var). The effect reads `varOf("cost.damageSelf")`. Bounds for both cards: 1 to `remainingHpOf(
yourIdentity)` (§4.2 Q46). Log: the existing cost-damage events carry the amount.

**What follows from the rules, to test.** Choosing all remaining hit points pays the cost, Deadpool "would be
defeated" (RRG "Damage", p. 14, step 6), §3.78 replaces it, and the event's effect still resolves from alter-ego
form, since the form was checked when the ability was initiated: the pack's signature play. Living Weapon-style
"after you take damage" responses to the cost resolve before the text after the arrow (RRG "Cost Arrow Icon",
p. 14). Involuntary Procedures gains its threat from this damage.

### 3.80 A resource card whose yield is computed

> **Status: partial.** A resource card's yield is its data (`producesIcons`), multiplied by `ResourceMultiplierSpec
{ factor: number, forThisCard: true, resource? }` (`abilities.ts`, read in `actions.ts` `multiplyPool`; Lightspeed
> Flight, `nova`). The factor is a constant and there is no additive form.

**Cards.** Montage (44007, [wild]): "This card generates 1 additional [wild] resource for each acceleration token
on the main scheme (to a maximum of 3 additional resources)." Self Confidence, Self Control, Self Preservation
(44025–44027, one of each type): "Double the number of resources this card generates if your identity has sustained
less than 5 damage (triple the resources instead if you have sustained no damage)."

**Plan.** Two small extensions of the constant a resource card already carries, both read at the moment the card is
spent:

- `factor: number | ValueSpec`. The three Self cards: `ifElse(valueEquals(damageOn(yourIdentity), 0), 3,
ifElse(valueAtMost(damageOn(yourIdentity), 4), 2, 1))`. "Sustained" is the damage on the identity now.
- `additional?: { resource: ResourceType; amount: ValueSpec }`, added before any multiplier applies. Montage:
  `min(accelerationTokensOn(theMainScheme), 3)` wilds (§3.76).

The printed resource stays one icon (January 11, 2026 - Ruling 3: a "printed resource" is the bottom-left icon), so
Rock, Paper, Scissors, Rictor and Hack 'n' Slash count 1 for each of these cards. Each generated wild is declared
separately (RRG "Wild Resource", p. 48). Other multipliers stack by multiplication, as `multiplyPool` documents.

### 3.81 "Search your collection"

> **Status: missing.** No effect reaches outside the game (searched "collection": only the scenario area The
> Collection, wave 3 §3.14). Every card instance is created at setup today.

**Card.** Armed to the Teeth (44009): "Response: After you play Armed to the Teeth, search your collection for 1
WEAPON upgrade from any aspect and attach it facedown here. Action: Exhaust Armed to the Teeth → swap the card
attached here with a WEAPON upgrade you control."

**Rules.** RRG 1.8 "Search" (p. 39): the player "looks through all of their Marvel Champions cards outside of the
current game for the specified card. They become the owner of that card until the end of the game." Deadpool insert
FAQ (§0): any aspect, not the deck's alone; campaign and identity-specific cards excluded. December 17, 2025 -
Ruling 4, answer 1: a card removed from the game "does not become a part of the collection" and cannot return;
answer 3: set-aside cards are in the game, the collection is outside it.

**What a digital collection is.** There is no shelf of owned cards: the nearest thing is the playable card pool
(`GameState.cardPool`), which is every released card the app carries. The choice of what counts and how many
copies exist is §4.2 Q47.

**Plan.**

- **`EffectSpec searchCollection { filter: TargetQuery; bind }`**: a `chooseCards`-style choice over the card
  **definitions** in the pool that match the filter (type upgrade, trait WEAPON, an aspect classification) and are
  available under Q47's rule. The pick creates a new `CardInstance` owned by the searching player. Optional: finding
  nothing, or declining, attaches nothing.
- **Determinism.** The pool is part of the game's configuration and the pick is a command, so a replay recreates
  the instance; log `cardAddedFromCollection { cardId, instanceId, owner }`. Instance ids come from the existing
  counter.
- **Removed from the game** needs no code: such a card stays in the game's removed zone and the collection is
  defined as what is outside the game.
- **Attached facedown** is §3.58 (a facedown player card on a card its owner may look at).
- **The Action** is `swapCards` (§3.57) between the facedown attachment and a WEAPON upgrade you control: the one
  turned up **enters play** under your control without being played (unique and restricted checks run, "after you
  play" does not), the one turned down **leaves play** (its counters and attachments go, "leaves play" abilities
  fire) and becomes the facedown attachment. No WEAPON upgrade under your control, no swap: the found card cannot
  simply be put into play. A permanent weapon (X-23's Claws) cannot leave play, so it is no swap target (RRG
  "Permanent", p. 32).
- When Armed to the Teeth leaves play, the attachment goes to its owner's discard pile, and from there into their
  deck like any other card.

### 3.82 "Counts as 2 restricted cards"

> **Status: missing.** `restrictedCardsOf` (`packages/engine/src/select.ts`) counts cards with the keyword;
> `checkRestricted` (`resolve/enter-play.ts`) runs only when a card with the keyword enters play and compares the
> count with `restrictedLimitFor` (`rules.ts`; `RuleSpec restrictedLimit` raises the limit). Laser Swords has no
> restricted keyword and is emitted with the sentence as a constant ability ref.

**Card.** Laser Swords (44055, WEAPON): "Counts as 2 restricted cards. Max 1 per deck."

**Plan.** Data, not a script, so it holds without the card's script (the argument of §3.71):
`PlayerCard.restrictedWeight?: 2`, parsed from "Counts as N restricted cards." One reader, `restrictedLoadOf(state,
player)`: 1 for each card with the keyword, the weight for each card that has one. It replaces the count at the
three places the limit is checked (`enter-play.ts`, and the two `actions.ts` sites that warn before a play), and
`enterPlay` runs the check for a weighted card as it does for a keyword card. Over the limit, the player discards
until the load fits (RRG "Restricted", p. 38). Which cards may be discarded, and whether Laser Swords "is" a
restricted card for other text: §4.2 Q52. With Psylocke's two Psi-Katanas (§3.64, Q38) it can never stay in play.

### 3.83 Facts from outside the game

> **Status: missing.** The engine has no clock, no memory of earlier games and no way to hear a player (searched
> "previousGame", "Date.now", "realTime": nothing in `packages/engine/src`), and it must not gain any: a replay has
> to produce the same game.

**Cards.** Git Gud (44028): "Reduce the cost to play Git Gud by 2 if you did not win your previous game of Marvel
Champions." Break Time (44046): "Alter-Ego Action: Take a group break. Leave the table. Read a comic book. When you
come back to the game, heal 1 damage from each identity for every minute you were away from the game." The Merc
with the Mouth (44032): "Forced Response: After the player phase ends, if you have not talked this phase, discard
this card."

**What a digital game can and cannot do.** It can measure how long a pause lasted, remember how a profile's last
game ended, and ask a question. It cannot know whether the players left the table or read a comic, whose "previous
game" a shared device's last game was, or whether anyone spoke. Each card therefore needs a decision about what
stands in for the unobservable fact (§4.2 Q48, Q49, Q50); the engine's part is the same for all three:

**One rule: an outside fact is an input, recorded in the log.**

- **Known before the game:** `PlayerSetup.outsideFacts?: { wonPreviousGame?: boolean }`, supplied by the client,
  stored in the state, read by `Predicate outsideFact("wonPreviousGame")`. Absent means false, which is the insert's
  ruling for a forgotten or a first game. Git Gud's reduction is a `costModifiers` entry with `activeIn: "hand"`
  (`abilities.ts`: "read from the card being played while it is in hand", Hercules) and `while:
not(outsideFact("wonPreviousGame"))`.
- **Known only when the card resolves:** `EffectSpec reportFact { fact: "minutesAway" | "talkedThisPhase"; bind }`
  opens a choice of kind `reportFact` addressed to one player; the client answers with a number or yes/no however it
  obtains it (a timer, a prompt) and the answer is an ordinary command in the log. `<bind>.amount` is the number.
  The engine never reads a clock.

The rest composes. Break Time: alliance (§3.5), a per player cost of 3 (§3.4; the insert's example: three players
pay nine), alter-ego form, `heal(each identity, varOf("break.amount"))`. Git Gud's interrupt is §3.78. The Merc with
the Mouth stays in its player's play area (§3.70; it prints no way to buy it off): `exhaust` each ally you control,
`cannotReady` on them, `cannotResolveTriggeredAbilities` for the other players during your turn (§3.60's
player-scoped bans; verify that "player card abilities" covers actions, responses, interrupts and resource
abilities on player cards and leaves encounter-card Actions alone), and the forced response at the end of the
player phase discards it unless the reported fact says the player talked.

### 3.84 Marked spaces on a card

> **Status: exists (compose).** Named counters on a card (`addCounters`, `countersOn`), a typed resource cost
> (`spendResources`), `removeThreat`, `heal` and `ifThen` cover both cards. Nothing new in the engine; the layout is
> the client's.

**The scans.** Blackout (44053) prints six spaces: two [energy], two [mental], two [physical]. Tic-Tac-Toe (44057)
prints a 3 × 3 grid whose top row is three [energy] spaces, middle row three [mental], bottom row three [physical].
Neither prints a [wild] space.

**Cards.** Blackout: "Hero Action: Spend 1 resource of any type → move 1 threat from a scheme to an empty space
above that matches the spent resource. If all spaces above are filled, discard this card and confuse the villain."
Tic-Tac-Toe: "Hero Action: Spend 1 resource of any type → move 1 damage from a character to an empty space above
matching the spent resource. If there are 3 damage tokens in a line, deal all damage on this card to an enemy and
discard this card." Deadpool insert: a line is a row, a column or a diagonal.

**Rules.** RRG 1.8 "Move" (p. 30): "If there is no valid source or destination for a move, the move cannot be made";
"If damage is moved off a character, the moved damage is considered to be healed from that character." "Heal"
(p. 22) says the same.

**Script.**

- A space is a counter type on the card: Blackout `energy`, `mental`, `physical`, each holding at most 2 (the two
  spaces of a type are interchangeable); Tic-Tac-Toe nine types `r1c1` … `r3c3`, each at most 1.
- One action per resource type, so the cost names its type and the action is offered only while a matching space is
  empty and a source exists (a scheme with threat; a character with damage): `spendResources({ energy: 1 })` with
  `while: valueAtMost(countersOn(self, "energy"), 1)`. Tic-Tac-Toe then lets the player choose which empty space of
  that row takes the token (`choose` over the empty columns).
- The move: `removeThreat(1, chosen scheme)` or `heal(1, chosen character)`, then `addCounters(self, space, 1)`.
  Not a thwart or an attack (no label). Whether a crisis icon stops Blackout taking threat off the main scheme, and
  what a wild resource matches, are §4.2 Q51.
- Blackout's end: all six counters → `discard(self)`, `giveStatus(theVillain, "confused")`.
- Tic-Tac-Toe's end: any of the eight lines full (`anyOf` of eight `allOf` over `countersOn`) → deal damage equal to
  all tokens on the card to a chosen enemy, discard the card. Forced as soon as a line exists. A row costs three
  resources of one type; a column or diagonal one of each. Avoiding a line, the card can hold six tokens before the
  next one must complete a line.

Tokens on these cards are not threat or damage "in play" on a scheme or character: nothing else reads them.

**Client.** Each card needs its spaces drawn where the art prints them and tokens shown in them; the nine or six
positions are view data keyed by card id (§5.5).

### 3.85 "After X takes any amount of damage" when the damage defeated X

> **Status: exists (verify).** `on.damage(target)` as a response; `resolve/triggers.ts` drops a pending response
> whose card "left play while the forced tier resolved" and offers a response only from a card in play.

**Cards.** X-23 (43001a): "_Living Weapon_ — Response: After X-23 takes any amount of damage, ready X-23. (Limit
once per phase.)" Honey Badger (43003): "Hero Response: After Honey Badger takes any amount of damage, ready X-23."

**Rules.** RRG 1.8 "Damage" (p. 14): the discard of a defeated character (step 8) comes before "after [character]
… takes any amount of damage" abilities (step 9). FAQ, Honey Badger (#3), p. 64: "By the time Honey Badger's
'Response' would trigger, she has already left play, so it cannot be triggered."

**Verify, one test each.** Honey Badger takes 1 damage and survives: X-23 may be readied (hero form only: "Hero
Response"). Honey Badger takes lethal damage, consequential included: no response is offered. Damage wholly
prevented, by a tough status card or otherwise, is not "any amount". Living Weapon answers cost damage (X-23's
Claws, Grim Resolve), each phase once, the villain phase included; "ready X-23" on an identity that is already ready
is still a legal trigger and uses the limit, so the client should not prompt for it by default.

### 3.86 An obligation that holds a card facedown under it

> **Status: exists (verify).** `EffectSpec tuckCards` with the `tucked` zone and the DSL's `tuckedUnderRef` /
> `tuckedCount` (cards under a card, out of play); an obligation that stays in play until its own ability discards
> it is §3.70.

**Card.** Self-Isolation (43028): "Give to the Laura Kinney player. Search your hand, deck, discard pile, and play
area for Honey Badger and place her facedown under this obligation. If you cannot, discard this card and deal
yourself 1 facedown encounter card. Response: After you make a basic recovery, discard this obligation and Honey
Badger."

**Script.** No "choose" at reveal: `find` Honey Badger (43003) across the four places (shuffle the deck if it was
searched, RRG "Search", p. 39), `tuckCards` her under the obligation; `choiceFoundNothing` → discard the obligation
and `dealEncounterCard(you)`. The response is `on.basicRecovery(you)` → discard the obligation and move her to her
owner's discard pile.

**Verify.** `tuckCards` takes a player card from each of the four zones and puts it under an obligation in a play
area. Taken from play she leaves play without being defeated: her damage and attachments go, no "when defeated".
While she is under the card nothing finds her: Sisterhood, Laura Kinney's Action, Sisterly Bond and Claw Mastery's
overkill ("while Honey Badger is in play") all see no Honey Badger. "If you cannot" is the case where she is in the
victory display or removed from the game, or the Laura Kinney player's deck never held her.

### 3.87 Reusable as is, pass 2c (checked against the engine unions)

**Reprints** (raw `duplicate_of_code`): Moment of Triumph 43017 → 12030, Energy 43022 → 01088, Genius 43023 → 01089,
Strength 43024 → 01090, IPAC 43025 → 41022 and X-Bunker 43026 → 41023 (§3.72), Endurance 43027 → 36026, Frenemies
44031 → 40026 (§3.61). They go in the wave's `reprints.ts`.

**Same title, different card.** Wave 6 scripted Boom Boom 32090 (`wave6/mut_gen/project-wideawake.ts`): "bomb"
counters placed on enemies and a delayed effect at the end of the player phase. Boom Boom 43013 is new text: "boom"
counters on herself and a discard she chooses. A new script and a new counter name; the two share a title, so the
unique rule keeps them out of play together. Rictor 43014 and 32089 likewise. Cable 44002 is the ally of the
identity 40001a, and the basic ally Deadpool 40024 cannot be played beside the identity (RRG "Unique Icon",
pp. 45–46).

**Waiting on an earlier row, otherwise ordinary:** Rictor (43014: a deck discard and its printed resources, §3.55,
§3.56); Keep Them Busy (43018: §3.1, §3.3, Q2; `removeThreat(perPlayer(0, 5), theMainScheme)` by `defeatingPlayer`);
Rally the Troops (43039: §3.1; `heal(each ally, 2)`, every player's allies); Live Dangerously (44024: §3.1, §3.77;
`gets("handSize", 2)` on each identity; it has no When Defeated and is worth more in play than defeated);
'Pool-ized (44041: §3.44's table, one scripted test, with the erratum's "Attached ally engages its controller").

| Card                                                                          | Reading                                                                                                                                                                                    | Existing vocabulary                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laura Kinney 43001b                                                           | Setup: X-23's Claws into play; once per round shuffle Honey Badger or Sisterly Bond from the discard pile into the deck → draw 1                                                           | a `setup` ability over the set-aside permanent (wave 6 §3.74); `chooseCards` by title in the discard pile, `moveCards`, `shuffleDeck` as the cost; `draw(1)`; a round limit                                                                                                                                      |
| X-23's Claws 43002, Grim Resolve 43010, Deadpool's Katana 44010               | exhaust and take 2 / 1 / 1 damage → +2 ATK until the end of the round / a [wild] resource / 2 damage with piercing                                                                         | `exhaust` and `damageSelf` costs (`cost-damage.ts`), on a resource ability for Grim Resolve; lasting `gets("atk", 2)`; `attack.keywords: ["piercing"]`                                                                                                                                                           |
| Animal Instinct 43004, Sisterly Bond 43007                                    | X-23's basic thwart gets +X THW, X her ATK; Honey Badger's thwart or attack adds X-23's matching power                                                                                     | `on.basicPowerUsing`, `modifyBasicPower(statOf(…))` (wave 6 §3.39); verify the interrupt on an ally's basic power                                                                                                                                                                                                |
| Claw Mastery 43005                                                            | +2 ATK until the end of the round, and overkill on her attacks while Honey Badger is in play                                                                                               | lasting `gets`; a lasting `attackKeywords` rule with `while: inPlay(titled)`; data `maxPerRound`                                                                                                                                                                                                                 |
| Regenerative Longevity 43006                                                  | heal a total of 4 from your identity and Honey Badger                                                                                                                                      | the divided heal (`dsl/divide-heal.test.ts`)                                                                                                                                                                                                                                                                     |
| Sisterhood 43008                                                              | exhaust, discard an X-23 card from hand → Honey Badger from deck or discard pile to hand                                                                                                   | `discardFromHand` with `identitySetOf(you)`; `find` across two zones; `shuffleDeck`                                                                                                                                                                                                                              |
| Adamantium Lacing 43009                                                       | +2 hit points; retaliate 1; piercing on her basic attacks                                                                                                                                  | `gets("hp", 2)`, `gainsKeyword`, `attackKeywords` limited to basic attacks (as Psi-Katana, §3.64)                                                                                                                                                                                                                |
| Pain Tolerance 43011                                                          | after you play an X-23 card, itself included, heal 1                                                                                                                                       | `on.youPlay(identitySetOf(you))` and `on.youPlayThis`                                                                                                                                                                                                                                                            |
| Puncture Wound 43012                                                          | on an enemy X-23 or Honey Badger attacked this turn; −1 ATK; when the player phase begins, discard it and deal 3                                                                           | data `attackedThisTurnBy` (`resolve/reveal.ts`, `GameState.attackedThisTurn`; verify, §0); `statModifiers`; forced `on.phaseBeginning`                                                                                                                                                                           |
| Boom Boom 43013                                                               | exhaust → 1 boom counter on her; then she may be discarded for 1 damage to each enemy per counter                                                                                          | `addCounters(self, "boom")`; an optional `ifThen`; `countersOn(self)` bound before `discard(self)`; damage to `each(enemy)`                                                                                                                                                                                      |
| Shatterstar 43015                                                             | when he attacks a minion, engage it; already engaged with you, +1 ATK for the attack                                                                                                       | `when.attacks(self)`, `engage`, a stat bonus until the attack ends                                                                                                                                                                                                                                               |
| Critical Hit 43016, Predictable Ploy 43038, Anticipated Attack 43040          | only with a side scheme in the victory display: stun the enemy you attacked / cancel a treachery's When Revealed / a tough status card as an enemy initiates an attack                     | `playOnlyIf(victoryDisplayCount ≥ 1)` (Mission Planning, §3.61); `on.attacks(you)`, `giveStatus`; `cancelWhenRevealed`; a defense-labeled interrupt on `enemyAttack`                                                                                                                                             |
| "Now I'm Mad" 43019                                                           | below half your starting hit points: +1 ATK, −1 THW                                                                                                                                        | `gets` with `while` comparing `remainingHpOf` to `printedHpOf` (RRG p. 22: starting is printed)                                                                                                                                                                                                                  |
| The Direct Approach 43020                                                     | the attached side scheme gains assault                                                                                                                                                     | `gainsKeyword(host, "assault")`; §3.3 already reads a granted assault                                                                                                                                                                                                                                            |
| Lady Deathstrike 43029                                                        | When Defeated: the defeating player discards the top encounter card and takes 1 indirect damage per boost icon                                                                             | `whenDefeated`, `defeatingPlayer`, `discardEncounterCards` with a bind, `boostIconsOn`, `dealIndirectDamage`                                                                                                                                                                                                     |
| In the Name of Vengeance 43030, Critical Wound 43032                          | each enemy gains retaliate 1; on your identity, when your turn ends discard it and take 4                                                                                                  | `gainsKeyword(each enemy)`; a forced interrupt at the end of your turn                                                                                                                                                                                                                                           |
| Cybermods 43031                                                               | on Lady Deathstrike, else discard until a minion, put it into play engaged and attach; the minion is shuffled into the deck instead of discarded                                           | data `namedCard` host; `discardEncounterUntil`, `putIntoPlay`, `attach`; `RuleSpec discardFromPlayDestination`                                                                                                                                                                                                   |
| Hack 'n' Slash 43033                                                          | discard 1 random card from hand, take damage equal to its printed resources (also as Boost)                                                                                                | `discardFromHand` at random with a bind, `totalPrintedResources`                                                                                                                                                                                                                                                 |
| Wade Wilson 44001b                                                            | discard a card → a Deadpool event from the deck to hand, once per round                                                                                                                    | `discardFromHand` cost; `chooseCards` with `identitySetOf(you)` and type event; `shuffleDeck`                                                                                                                                                                                                                    |
| Metaknowledge 44005                                                           | cancel all effects of a revealed encounter card and discard it; take 1 damage per star and boost icon on it                                                                                | Lucky Break's `cancelRevealedCard` (§3.61); `boostIconsOn` plus `starIcons`; a flipping environment is not "revealed" (June 25, 2026 - Ruling 4, answer 3), which `encounterCardRevealed` already excludes                                                                                                       |
| Chimichanga Truck 44008, Healing Factor 44029, Stick-To-Itiveness 44030       | ready an identity after its basic recovery; heal 2 as the player phase begins; spend [physical] and exhaust to ready your hero                                                             | `on.basicRecovery`, `on.phaseBeginning`, `spendResources` and `exhaust` costs, `ready`, `heal`                                                                                                                                                                                                                   |
| This Card is Fire 44012                                                       | in your hand when your turn ends: take 1 damage; X damage, X the damage you have sustained                                                                                                 | a forced response with `activeIn: "hand"` (`resolve/triggers.ts`; Pip the Troll, wave 4 §3.13); `damageOn(yourIdentity)`. Nothing here is outside the game: it is a card that acts from the hand                                                                                                                 |
| Dogpool 44013, Kidpool 44015, Lady Deadpool 44016, Bob 44043, Pandapool 44045 | keywords; When Defeated effects; piercing; a choice on entering play                                                                                                                       | data keywords; `whenDefeated`; `attackKeywords`; `on.entersPlay` with `choose`; their icons are §3.77                                                                                                                                                                                                            |
| Headpool 44014                                                                | after he attacks and damages a minion, it attacks another enemy of your choice                                                                                                             | `on.attacks(self)` with `<bind>.damaged`; `enemyAttacksEnemy` (wave 3 §3.23). January 26, 2026 - Ruling 4, answer 1: Headpool's controller resolves the boost card of a villainous minion (verify who is "you" in that Boost)                                                                                    |
| Cutupper 44018, Get Rage-y 44020                                              | 5 damage and stun; ready an ally, +1 ATK until the end of the phase                                                                                                                        | ordinary                                                                                                                                                                                                                                                                                                         |
| Not my Responsibility 44022                                                   | threat that would be placed on a scheme is taken as damage by you or your ally                                                                                                             | an interrupt on `threatPlaced` with `cancelTriggeringEvent` and `dealDamage(eventAmount)` to a chosen identity or ally (verify it is offered for every source of threat, step one of the villain phase included)                                                                                                 |
| Butler 44033, Involuntary Procedures 44034                                    | his scheme threat goes on that side scheme; 1 threat after "Deadpool" takes damage, removed from the game at 10                                                                            | `RuleSpec schemeThreatDestination`; `on.damage(titled("Deadpool"))`: the hero face or the ally 40024, not Wade Wilson (RRG "Identity", p. 23, as Q37); `moveCards(self, "removedFromGame")`                                                                                                                      |
| Tabula Rasa 16 44035, Anti-Regeneration Ray 44040                             | your identity's printed text box is blank; the attacked non-villain character's is blank until the attack ends; spend three resources to take the Ray                                      | `blankTextBox` (§3.19), lasting for the Ray; `spendResources`; `attach(self, yourIdentity)`, after which Deadpool's own attacks blank minions                                                                                                                                                                    |
| Mutated Soldier 44036                                                         | toughness; heals all damage after it activates                                                                                                                                             | `on.enemyActivates(self)`, `heal` all                                                                                                                                                                                                                                                                            |
| Dreadpool 44038, Dreadful Deeds 44039, Metacidal Tendencies 44042             | engages the first player, dealt facedown to whoever defeats him; 2 threat per player controlling a 'Pool card; 2 (or 3) damage to each DEADPOOL CORPS character, a token if none was dealt | `engage(firstPlayer)` as he enters play; `dealAsEncounterCard(defeatingPlayer)`; `countOf(playersWhere(exists(query({ aspect: "pool" }))))`; `<bind>.amount`, `addAccelerationToken`                                                                                                                             |
| Negasonic Teenage Warhead 44044, Get in Front of Me! 44047                    | cancel a treachery's When Revealed for 2 damage to her / and the villain attacks you, draw 1 if an ally or another hero defends                                                            | `dealDamageCost(self, 2)`, `cancelWhenRevealed`; `enemyAttack`, a test of the defender                                                                                                                                                                                                                           |
| Mulligan 44048                                                                | not if you played another card this phase; discard your hand, draw up to your hand size                                                                                                    | `playOnlyIf` over `GameState.playedThisPhase` (verify a "this phase" predicate beside `playedThisTurn` and `playedThisRound`); `discardFromHand` all; `drawUpTo(handSizeOf(you))`. An ordinary card in a digital game                                                                                            |
| Deadpool Corps Ship 44049                                                     | exhaust and deal yourself a facedown encounter card → a 'Pool ally from hand into play                                                                                                     | `dealEncounterCardsCost(1)`; `putIntoPlay` from hand with `aspect: "pool"`, type ally                                                                                                                                                                                                                            |
| Plot Convenience 44050                                                        | any player: attach an aspect card from hand facedown here (at most 3), or take one of them into hand                                                                                       | §3.58; `triggerableBy` every player (wave 6 §3.11); §4.2 Q53                                                                                                                                                                                                                                                     |
| Ambush 44051, Distraction 44054                                               | when the attached side scheme is defeated, discard a non-ELITE minion; the attached minion cannot activate                                                                                 | `when.schemeDefeated(host)`, `discardFromPlay`; `RuleSpec cannotActivate`                                                                                                                                                                                                                                        |
| Rock, Paper, Scissors 44056                                                   | exhaust, choose a hand card, discard the top of your deck; if a printed resource on the chosen card beats one on the discarded card, take the discarded card                               | the scan's diagram: [energy] beats [mental], [mental] beats [physical], [physical] beats [energy], [wild] beats those three and nothing beats [wild] (insert FAQ). `chooseCards` in hand, a deck discard with a bind (§3.55), `anyOf` over the six pairs with `refMatches` on printed icons, `moveCards` to hand |
| War 44058                                                                     | exhaust: discard the top encounter card and take 1 damage per star and boost icon; discard the top of your deck and deal its cost as damage                                                | `discardEncounterCards`, `boostIconsOn`, `starIcons`; a deck discard with a bind; `printedCostOf` (0 for a card with no cost)                                                                                                                                                                                    |

---

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

Answered 2026-10-04. Q1, Q3, Q4 and Q5 first (all A); the rest in one reply the same day. Eleven differ from the proposed default and are marked. Q2, Q11, Q48, Q49 and Q50 were sent back for clarification and answered after it, the same day. **All 53 questions are answered.**

| Q   | Decision                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | A: at the player side scheme limit the new scheme enters play, then the playing player discards any player side scheme in play, the new one included; for one put into play by an effect, the first player chooses (MC40 p. 21).                                                                                                   |
| Q3  | A: a divided basic thwart that includes an assault scheme uses ATK, and an ally takes its ATK consequential damage (RRG 1.8 p. 8). This changes how divided thwarts already in the game resolve in that case.                                                                                                                      |
| Q4  | A: a Marauder minion revealed while the villain of its title is in play is discarded and the player is dealt a facedown encounter card (RRG 1.8 p. 46 over MC40 p. 21).                                                                                                                                                            |
| Q5  | A: "attacks you" abilities resolve against the attacked player when the attack is against an ally they control (RRG 1.8 p. 10 over MC40 p. 5), for every card.                                                                                                                                                                     |
| Q2  | **Owner's own answer (none of A–C):** when no player removed the last threat, the When Defeated still resolves with no player as its source: the damage or threat removal happens, no identity-keyed response triggers and no player-specific restriction applies to it.                                                           |
| Q11 | A: with no dealing player Hidden in the Clutter causes no attack and is still discarded.                                                                                                                                                                                                                                           |
| Q48 | **Owner's definition:** Git Gud reads each seat's local profile history; only games completed as a win or a loss count (abandoned games are not in the history); no history means "did not win"; campaign and standalone games share one history; the result is snapshotted into the game at setup.                                |
| Q49 | **Owner's definition (A, specified):** Break Time uses wall-clock time from playing the card, including time the app is backgrounded or suspended; whole minutes, rounded down; no cap; the minute count is stored in the log; the player who played the card ends the break.                                                      |
| Q50 | **Owner's definition (mixed):** in an online game a text message sent or an open microphone from that seat during the player phase counts as talking, and with neither the player is asked at phase end; on one device or in solo play the player is always asked.                                                                 |
| Q6  | A: Morlock's redirect covers every enemy attack whose attacked player is you (an attack on another ally you control included); you choose among your Morlocks; forced.                                                                                                                                                             |
| Q7  | A: "cannot remove this ally from play" blocks moving or outright defeating the card; damage from any source can still defeat a Morlock.                                                                                                                                                                                            |
| Q8  | A: an encounter "choose" option is offered only if the player can carry it out in full; otherwise the other option is forced.                                                                                                                                                                                                      |
| Q9  | A: Hope's Captor replaces every attack activation, card-caused ones included, before the boost card is dealt.                                                                                                                                                                                                                      |
| Q10 | A: the replaced defeat sets hit points to the printed value, flips the card, and +6 per player raises the dial as well as the maximum (the owner's note: "gets +6 hit points" raises the current dial; RRG p. 22).                                                                                                                 |
| Q12 | A: Inhibitor Collar blanks both faces' text boxes while attached.                                                                                                                                                                                                                                                                  |
| Q13 | **B (not the default):** Pushed to the Limit's ability cannot be triggered while the attached villain could not attack (e.g. stunned).                                                                                                                                                                                             |
| Q14 | **B (not the default):** Hope Summers's THW and ATK are 0 while her controller is in alter-ego form.                                                                                                                                                                                                                               |
| Q15 | A: Head of Steam after an attack that dealt 0 damage costs zero resources and may be discarded.                                                                                                                                                                                                                                    |
| Q16 | A: once Sinister Ends sends the attack to Hope Summers, her controller is the attacked player.                                                                                                                                                                                                                                     |
| Q17 | A: Out of Reach blocks damage that has no attack behind it.                                                                                                                                                                                                                                                                        |
| Q18 | **B (not the default):** "most common card type in your hand" counts only the six player card types MC40 p. 18 lists; an encounter card held in hand is not counted.                                                                                                                                                               |
| Q19 | A: Living Bomb is revealed with its starting 3 threat plus the threat that was on Stryfe's Grasp.                                                                                                                                                                                                                                  |
| Q20 | **B (not the default):** RRG 1.8 Appendix II step 11 (p. 51) as written: setup-keyword cards in the encounter set-aside area are put into play too, and Mister Sinister's scenario is exempted by a scenario rule (MC40 p. 16). Check every earlier scenario that sets encounter cards aside for a setup keyword this now reaches. |
| Q21 | A: Stryfe at 0 hit points is defeated at once when Living Bomb leaves play, with no defeating player.                                                                                                                                                                                                                              |
| Q22 | A: Zero is shuffled back when no player defeated it.                                                                                                                                                                                                                                                                               |
| Q23 | A: Psychic Inertia counts any attack and any thwart by your hero, basic or by a labeled ability.                                                                                                                                                                                                                                   |
| Q24 | A: nobody controls a campaign player side scheme.                                                                                                                                                                                                                                                                                  |
| Q25 | A: Pouches is in the deck for that game only.                                                                                                                                                                                                                                                                                      |
| Q26 | A: an attached Malice is a minion only, never an "attachment".                                                                                                                                                                                                                                                                     |
| Q27 | A: Malice's host's SCH is its current THW, as printed.                                                                                                                                                                                                                                                                             |
| Q28 | **B (not the default):** the Morlocks Saved search happens after mulligans, as an extra card on top of the opening hand.                                                                                                                                                                                                           |
| Q29 | A: Technovirus Purge bars only characters other than Cable.                                                                                                                                                                                                                                                                        |
| Q30 | A: Temporal Leap's side scheme enters with its starting threat, unrevealed, then the 4 threat moves onto it. **Amended 2026-10-05:** its hinder is applied on entering (RRG p. 22).                                                                                                                                                |
| Q31 | A: any discard from the top of your deck counts, whoever's card causes it.                                                                                                                                                                                                                                                         |
| Q32 | **B (not the default):** a card its own response (or The Painted Lady) took away is not counted by the ability that discarded it (April 30, 2026 - Ruling 4, answer 1, applied generally).                                                                                                                                         |
| Q33 | A: a discard response on the deck's last card still resolves where the reset put the card.                                                                                                                                                                                                                                         |
| Q34 | **B (not the default):** all of A Good Workout's additional damage goes to the enemy the 4 damage was dealt to.                                                                                                                                                                                                                    |
| Q35 | A: Superpower Feedback counts triggered abilities and identity-specific events, not basic powers.                                                                                                                                                                                                                                  |
| Q36 | A: under Back to the Future the Cable player cannot damage the villain.                                                                                                                                                                                                                                                            |
| Q37 | A: Soaring Hearts cannot be played while the Angel player is Archangel.                                                                                                                                                                                                                                                            |
| Q38 | A: the restricted limit applies at all times; after a flip the player discards down to two.                                                                                                                                                                                                                                        |
| Q39 | **C (not the default):** "[mental] resources on cards you control" reads RRG p. 31 as written: cards in play, hand, deck and discard pile.                                                                                                                                                                                         |
| Q40 | **B (not the default):** for Psionic Illusion a printed wild icon matches any named resource type.                                                                                                                                                                                                                                 |
| Q41 | A: Aerial Agility answers any enemy attack.                                                                                                                                                                                                                                                                                        |
| Q42 | A: the face showing after an AERIAL event resolves answers it.                                                                                                                                                                                                                                                                     |
| Q43 | A: Body Swapped exhausts every PSI-ENERGY upgrade, including one already on its Psi-Katana side.                                                                                                                                                                                                                                   |
| Q44 | A: the Dreadpool set is in the game exactly when a seat chose 'Pool.                                                                                                                                                                                                                                                               |
| Q45 | A: Deadpool's defeat replacement resolves as far as it can when he cannot change form.                                                                                                                                                                                                                                             |
| Q46 | **B (not the default):** Maximum Effort and "Yoo-Hoo!" may take 0 damage (the event then does nothing but counts as played).                                                                                                                                                                                                       |
| Q47 | A: "your collection" is the WEAPON upgrades of the five aspects in the app's playable pool, with copy accounting.                                                                                                                                                                                                                  |
| Q51 | A: on Blackout and Tic-Tac-Toe a wild resource is spent as the type its player declares.                                                                                                                                                                                                                                           |
| Q52 | **B (not the default):** Laser Swords only weighs on the restricted limit; text that names restricted cards does not see it, and cards discarded for the limit must carry the keyword.                                                                                                                                             |
| Q53 | A: Plot Convenience lets the triggering player take any attached card, whoever owns it.                                                                                                                                                                                                                                            |

Four rulings on points the engine agents raised while building (owner, 2026-10-04):

| Point                                      | Decision                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campaign player side schemes and the limit | Exempt, because their card text says so ("This scheme does not count against the player side scheme limit.", 40190a–40195a), not because nobody controls them. They are scripted with `excludedFromPlayerSideSchemeLimit`; an unowned scheme without that text would count. |
| A scheme at zero threat                    | Already out of the limit while its When Defeated resolves.                                                                                                                                                                                                                  |
| A permanent or "cannot leave play" scheme  | Counts toward the limit but cannot be selected for the forced discard; if the new scheme is the only eligible one, it is discarded; if none can legally leave, nothing is discarded.                                                                                        |
| Assault consequential damage               | The ATK column gives the amount; it is still consequential damage from thwarting ("after it thwarts" applies, "after it attacks" does not).                                                                                                                                 |

Nine rulings on points the engine agents raised overnight (owner, 2026-10-05):

| Point                                                          | Decision                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A permanent side scheme at 0 threat                            | **Not defeated** (RRG 1.8 "Permanent", p. 32). The engine changes; the three older tests that relied on it being announced as defeated are updated to the rule. No exception for Stryfe's Grasp unless its own text requires one.                                                                                                                                                                                                  |
| Hope Summers's controller                                      | Follows the first-player token each round (as built).                                                                                                                                                                                                                                                                                                                                                                              |
| Hope Summers's card back                                       | Encounter-backed: she is never player-owned. Data fix.                                                                                                                                                                                                                                                                                                                                                                             |
| Q30 and hinder                                                 | **Supersedes Q30's "no hinder":** a side scheme returning from the victory display gets its hinder (RRG 1.8 "Hinder X", p. 22). Still not revealed.                                                                                                                                                                                                                                                                                |
| A basic attack against a character that cannot take its damage | **Refused, following FFG (owner, 2026-10-05, replacing the same day's first answer).** RRG 1.8 "Target" (p. 43): a target that "cannot take damage" is not a valid target for an ability or game function whose only effect on that target is to deal it damage. Ruling March 19, 2026 - Ruling 2: it applies equally to basic powers. As built (`basic-attack-cannot-take-damage.test.ts`, and task 18's tests for Out of Reach). |
| Flip-and-reveal                                                | Counts as revealed; effects that cancel a revealed encounter card can answer it (as built).                                                                                                                                                                                                                                                                                                                                        |
| An enemy attack as a cost, canceled after the ability began    | The cost is unpaid and the card stays (as built).                                                                                                                                                                                                                                                                                                                                                                                  |
| The ally limit and "card abilities cannot remove this ally"    | The ally limit's forced discard is a game rule and can discard such an ally (as built).                                                                                                                                                                                                                                                                                                                                            |
| An eliminated player's cards in the victory display            | They stay; elimination does not change the victory count (as built).                                                                                                                                                                                                                                                                                                                                                               |

Three rulings on points raised while scripting the box's player cards (owner, 2026-10-05, checked by the owner
against FFG material including RRG 1.8):

| Point                                                                         | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E.V.A. (40021) with no Fantomex in play                                       | **Discarded immediately.** The NeXt Evolution FAQ asks "Can E.V.A. ever be in play while Fantomex is not?" and answers no: her constant ability discards her at once (the FAQ is the owner's citation; the insert is not in the repo). RRG 1.8 "Ability" (p. 4): a constant ability "becomes active as soon as its card enters play". The discard is not delayed until her entering-play windows close.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Older "If ..." state checks (about 20 scripts)                                | **Left as they are; audited one at a time, never opted in as a group.** An "if" inside a constant ability is a standing condition, not a trigger, so change-only is potentially wrong for it, but setup has its own ordering and a blanket change risks an effect resolving at initialization. Each is classed first: a continuous modifier, a game-state condition (win or loss), a triggered effect with an "if" qualifier, or setup-sensitive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Uncanny X-Force (40022)                                                       | **As built.** While each of your characters has X-FORCE, each ally you control gets +1 THW against any scheme; the -1 consequential damage applies only after thwarting a side scheme ("after thwarting a side scheme" modifies only the damage clause).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Action abilities during another player's turn                                 | **A: allowed, no consent prompt (owner, 2026-10-05, checked against RRG 1.8 "Player Turn", pp. 34-35, and "Action", p. 6).** During the active player's turn another player may trigger an Action ability they could legally trigger on their own turn, whenever an Action could presently be taken; initiating it is that player's offer ("Another player may offer to use an action during the active player's turn, as well"), so the engine asks nobody. Every normal check reads the acting player: cost, form, limits, control, "you". This is not a turn for the non-active player: no basic ATK/THW/REC/DEF power of their hero or allies, no form change, no playing an ally, support or upgrade; it covers Action abilities, including Action events played from hand. "Any player can do this" Actions follow the same rule. An approval prompt (B) would add a step the rules do not require; own-turn only (C) forbids what the RRG permits. |
| The Merc with the Mouth (44032), "Exhaust each ally you control."             | **A standing instruction, not a reveal effect (owner, 2026-10-05, from the printed card).** The card prints no "When Revealed:" heading, and text with no bold timing trigger is a constant ability (RRG 1.8 "Ability", p. 4). Allies the player already controls are exhausted while the obligation is in play, an ally that enters play or comes under their control becomes exhausted, and "Allies you control cannot ready" keeps them so. Sowing Discord (40161) prints "When Revealed: Exhaust each ally you control" and is one-time; the Merc does not. The data keeps one constant ref.                                                                                                                                                                                                                                                                                                                                                          |
| The Merc with the Mouth and Forced abilities                                  | **Stopped too (owner, 2026-10-05, checked against RRG 1.8 and FFG's ruling on the card).** "Other players cannot resolve player card abilities during your turn" covers triggered abilities (Action, Interrupt, Response) on cards in play and in hand; a Forced Interrupt or Response is still a triggered ability, and "cannot" is absolute and wins over a mandatory "Forced" (RRG 1.8 "Cannot", p. 11; "Forced", p. 20). No exemption for forced abilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| The Merc with the Mouth and "Any player may trigger" (Plot Convenience 44050) | **Stopped (owner, 2026-10-05).** "Any player may trigger this ability" is a permission, not an exception to the Merc's prohibition; "cannot" wins. During the Merc player's turn another player cannot use the Merc player's Plot Convenience.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| "Only the controller of the attached-to card" (RRG 1.8 "Attachment", p. 8)    | **Applies to any attached card, not only the Attachment card type (owner, 2026-10-05, citing an FFG rules answer that the rule "also applies to cards attached through other means").** An uncontrolled card attached to a player's card is triggered and paid for only by that card's controller.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Rulings on the points left open after the client work (owner, 2026-10-06, checked by the owner against RRG 1.8, its
change notes, the MC40 rules and post-1.8 FFG rulings; where a rules-contact answer and the RRG pull apart the owner
gives RRG 1.8 precedence). The owner cites card-specific FFG answers for Temporal Leap and Hidden in the Clutter; those
two answers are not in this repo's rulings transcript, so they are recorded here as the owner's decisions.

| Point                                                                                                                     | Decision                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tough and other status cards against "would be dealt" abilities                                                           | **Status cards first (as built).** RRG 1.8 gives status cards priority over other Forced Interrupts at the same timing point; the same priority applies at the damage timing. Hidden in the Clutter 40106 and Armored Rhino Suit keep the FAQ ordering; the expected-failure pins become plain tests of that ordering. |
| Hope's Captor "would attack" against "attacks you"                                                                        | **"Would" first, no ordering prompt** (RRG "Would", p. 48). Overrules the built first-player ordering.                                                                                                                                                                                                                 |
| Playing a restricted card over the limit                                                                                  | **Allowed.** Restricted is a state limit, not a play restriction: the play resolves, then the player at once chooses and discards restricted cards down to two (RRG "Restricted"). The engine's refusal is wrong.                                                                                                      |
| A "(defense)" ability used during an enemy attack with no defender declared                                               | **The hero becomes the defender; DEF is not applied.** It is not a basic defense, so declining to defend is not undone into a DEF calculation.                                                                                                                                                                         |
| Cypher 41013 and a killing blow on a confused enemy                                                                       | **He draws.** The attack damaged the enemy while it was confused; its defeat does not erase that.                                                                                                                                                                                                                      |
| Warpath 42013 in the villain phase                                                                                        | **He can play the Hero Action event.** His Response overrides the normal timing for that event.                                                                                                                                                                                                                        |
| 0 damage                                                                                                                  | **Opens no damage window**, as 0 threat opens none: nothing was damaged, so "takes damage" and "damages" responses do not fire.                                                                                                                                                                                        |
| A Restricted weapon turned up by Armed to the Teeth's swap                                                                | **The swap resolves, then the restricted limit is enforced** by discards.                                                                                                                                                                                                                                              |
| Trait lines such as "S.H.I.E.L.D. Soldier."                                                                               | **Two traits.** Split and regenerate the affected packs.                                                                                                                                                                                                                                                               |
| "You" on obligations and identity attachments                                                                             | **Roll the RRG reading out to the remaining rule readers, by context**: not a blind "you = the attached identity's controller"; the target, attack and resolving-player context still decide.                                                                                                                          |
| Temporal Leap when threat cannot leave the main scheme                                                                    | **Not offered.** Moving threat removes it first; with removal barred (a crisis icon) the card cannot be played. Overrules the built behavior.                                                                                                                                                                          |
| Hidden in the Clutter 40106                                                                                               | **As built:** it stays until 3 damage is on it and its sequence completes; if a stun replaces the resulting attack it stays attached.                                                                                                                                                                                  |
| Telekinetic Wave 40179                                                                                                    | **As built:** the card returns to its owner's hand.                                                                                                                                                                                                                                                                    |
| Live Dangerously and Dreadful Deeds 44039                                                                                 | **As built:** it counts.                                                                                                                                                                                                                                                                                               |
| 'Pool Inspection 44023                                                                                                    | **As built:** "ignoring the crisis icon" covers the first sentence only.                                                                                                                                                                                                                                               |
| A "(defense)" ability against damage that is not the attack's own; the Morlock redirect                                   | **As built:** the hero becomes the defender, and the redirect does not retarget afterward.                                                                                                                                                                                                                             |
| A Setup attachment when the villain enters during setup                                                                   | **As built:** it attaches as soon as its host enters play.                                                                                                                                                                                                                                                             |
| Campaign scenario 2's tough cards; "campaign environment"                                                                 | **As built:** enemies in play when the step resolves; the campaign side schemes' environments only.                                                                                                                                                                                                                    |
| The player-card Hope Summers 40204                                                                                        | **As built** (refused while the scenario's Hope is in play); in the campaign she is barred from player decks outright.                                                                                                                                                                                                 |
| A "once per turn" Action used off-turn                                                                                    | **As built:** it counts against the turn in progress.                                                                                                                                                                                                                                                                  |
| Git Gud 44028's "previous game"                                                                                           | **One definition everywhere:** a game is one finished as a win or a loss (Q48); an abandoned session is not a game, so it does not change the result. Seats sharing one local profile and a finished tutorial counting are app policy and stay as built.                                                               |
| Psi-Energy Control when a stun cancels the basic attack                                                                   | **Offered** (the owner's inference from RRG 1.8 status priority; no card-specific ruling).                                                                                                                                                                                                                             |
| A canceled When Revealed                                                                                                  | **No Surge, and it does not count as resolved for Pete Wisdom** (RRG 1.8 treats Surge as a When Revealed ability; FFG August 3, 2026 - Ruling 3).                                                                                                                                                                      |
| Progression unlocks, the scenario shelf at 1440, the story's reused panels and finale line, Break Time's 1,440-minute cap | **Confirmed as built** (product choices, no rules content).                                                                                                                                                                                                                                                            |

Carried from wave 6 §4.1 and applied here without asking again: Q1 (teamwork: only the entering minion activates),
Q2 (teamwork before When Revealed), Q36 (a new villain face goes through the reveal pipeline).

### 4.2 The questions as asked

Each is implemented the way stated, or not at all, and named here rather than decided silently. **A is the proposed
default in every question; none is implemented yet.**

1. **Playing a player side scheme at the limit: which one may be discarded?** (§3.2; RRG p. 34 "they must choose a
   player side scheme to discard"; MC40 p. 21 for one put into play: the first player's choice "could include" the new
   one.)
   - **A (default):** the new scheme enters play, then the playing player chooses any player side scheme in play,
     the new one included (the ally-limit handling); put into play by an effect, the first player chooses.
   - B: the playing player must choose one that was already in play.
2. **"The player who defeated this scheme" when no player did** (§3.1; an encounter effect removes the last threat
   from Lay the Trap or Keep Them Busy).
   - **A (default):** the scheme's controller resolves the When Defeated as that player.
   - B: the first player. C: that part of the When Defeated does nothing.
3. **Assault and a divided basic thwart** (§3.3). The engine today uses THW for any divided thwart.
   - **A (default):** RRG p. 8 as written: if any scheme of the divided thwart has assault, the character uses ATK
     for that thwart (and an ally takes ATK consequential damage). This changes current behavior.
   - B: keep THW for divided thwarts. C: a divided thwart cannot mix assault and non-assault schemes.
4. **A Marauder minion revealed while the villain of its title is in play.** MC40 p. 21: "the minion is discarded and
   the player who revealed it must reveal an additional encounter card." RRG 1.8 p. 46: "the player revealing it is
   dealt a facedown encounter card." The documents disagree; the engine follows the RRG (`unique.ts`).
   - **A (default):** RRG 1.8, the later document: dealt facedown, revealed in that player's turn of step 4.
   - B: MC40 for these minions: reveal another card at once.
5. **"Attacks you" abilities when the attack is against an ally you control.** MC40 p. 5: they "do **not** trigger".
   RRG 1.8 p. 10: they "resolve against the attacked player". The engine follows the RRG (`retargetAttack`'s doc).
   Matters for Gorgeous George, Hope's Captor and Morlock.
   - **A (default):** RRG 1.8 for every card.
   - B: MC40's rule while playing MC40 scenarios.
6. **Morlock's redirect: which attacks, and who picks the Morlock?** (§3.9)
   - **A (default):** every enemy attack whose attacked player is you, including one aimed at another ally you
     control (with Q5 = A); you choose among your Morlocks; forced, so you cannot decline while you control one.
   - B: only attacks aimed at your identity.
7. **"Card abilities cannot remove this ally from play"** (§3.10): does damage from a card ability count?
   - **A (default):** no. Only effects that move the card (discard, return to hand, shuffle, remove) or "defeat" it
     outright are blocked; damage from any source can still defeat a Morlock.
   - B: a Morlock cannot be defeated by damage from card abilities either, only by attacks.
8. **Choosing an encounter option you cannot carry out** (§3.11; RRG "Choose (Option)", p. 12, bars only an encounter
   option "that requires one or more targets if there are no valid targets"). Chimera with no [mental] resource to
   spend; Greycrow with no card to discard; Blockbuster already tough; Arclight with every character confused.
   - **A (default):** an option is offered only if the player can carry it out in full; otherwise the other option
     is forced (FFG's evident intent: the choice is a price).
   - B: p. 12 as written: only target-less options are barred, so "spend a [mental] resource" may be chosen with
     none and does nothing.
9. **Hope's Captor: "the villain schemes instead"** (§3.14).
   - **A (default):** the attack activation is replaced before its boost card is dealt; the villain schemes against
     that player with a normal boost card; it applies to attacks card effects cause ("The villain attacks you");
     abilities keyed on that attack do not trigger, those keyed on the scheme do.
   - B: only villain-phase step 2 activations are replaced.
10. **Hope's Captor: the replaced defeat** (§3.14).
    - **A (default):** the villain is not defeated (no "after you defeat" responses, nothing leaves it); hit points
      go to the printed value, the card flips, +6 per player raises the dial (RRG p. 22), then the When Revealed
      advances the scheme; excess damage is lost.
    - B: the +6 per player raises only the maximum, leaving the dial at the printed value.
11. **Hidden in the Clutter with no dealing player** (§3.17; retaliate-style or encounter-sourced damage).
    - **A (default):** the damage is placed; at 3 the attack is skipped for lack of a player, and the card is still
      discarded.
    - B: the first player is attacked.
12. **Inhibitor Collar: how much of the identity is blank?** (§3.19)
    - **A (default):** both faces' text boxes, keywords included, while the Collar is attached (the face showing is
      the one read); traits, stats, hand size and hit points stay; the Collar's printed ATK −1 applies in hero form.
    - B: only the face showing when the Collar attached.
13. **"Attached villain attacks you → discard this card" when the villain is stunned** (§3.19).
    - **A (default):** the ability may be triggered; the stun replaces the attack and is discarded, the cost is not
      paid, and Pushed to the Limit stays (the reading of RRG "Cost", p. 13, that an effect needs its cost paid).
    - B: the ability cannot be triggered while the villain could not attack.

**Pass 1b.**

14. **Hope Summers's base THW and ATK while her controller is in alter-ego form** (§3.25; the card: "equal to the THW
    and ATK of your hero"; ruling January 17, 2026 - Ruling 1 says only that the star is what the ability defines).
    - **A (default):** always the hero side's values: the current, modified THW and ATK in hero form; the hero face's
      printed THW and ATK while in alter-ego form (she stays useful on an alter-ego turn).
    - B: 0 while her controller is in alter-ego form (no hero is in play). C: the hero face's printed values always.
15. **Head of Steam when the attack dealt no damage** (§2.6: "spend 1 resource for each damage dealt by that attack →
    discard this card").
    - **A (default):** the cost is zero resources and the response may be triggered, discarding it for free (RRG
      "Cost", p. 13).
    - B: it cannot be triggered unless at least 1 damage was dealt.
16. **Sinister Ends: who is the attacked player once the attack goes to Hope Summers?** (§3.25; RRG p. 10: "The
    player who controls the ally is considered the attacked player".)
    - **A (default):** Hope's controller (the first player) becomes the attacked player for boost abilities and
      "attacks you" text, whoever the attack was first aimed at; defense follows the normal rules. Depends on Q5.
    - B: the player first attacked stays the attacked player; only the damage's target changes.
17. **Out of Reach and damage that is not from an attack** (§3.30: "cannot take damage unless the attacker or attack
    has the [AERIAL] trait, or the attack has ranged").
    - **A (default):** as written: damage with no attack behind it (a non-attack event, an ability, retaliate) has
      neither an attacker nor an attack and is blocked.
    - B: only attack damage is restricted; other damage lands.
18. **Most common type: which cards in hand form a group?** (§3.32; MC40 p. 18 lists the six player card types that a
    hand normally holds.)
    - **A (default):** every card in hand counts under its own printed type, so an encounter card held in hand (an
      obligation that stays in hand, wave 5 §3.5) is a group of its own type.
    - B: only the six listed types are counted.
19. **Living Bomb's threat when Stryfe's Grasp flips** (§3.34: "flip this card and reveal Living Bomb. Place any
    threat here on Living Bomb"; RRG "Flip", p. 20, keeps tokens; RRG "Side Scheme": a revealed side scheme enters
    play with its starting threat).
    - **A (default):** Living Bomb is revealed with its starting 3 threat **plus** the threat that was on Stryfe's
      Grasp (0 when the flip came from the last threat being removed).
    - B: only the carried threat, with a minimum of its starting 3. C: exactly 3.
20. **A setup-keyword card in a set that the scenario sets aside.** MC40 p. 16: the keyword on Flight, Super Strength
    and Telepathy "is ignored in this scenario because these cards are set aside during setup". RRG 1.8 Appendix II
    step 11 (p. 51): "Search each deck and the set aside area for any cards with the setup keyword and put them into
    play." The engine today reads encounter decks and each player's permanent set-aside cards, never the encounter
    set-aside area.
    - **A (default):** keep that for every scenario: an encounter card a scenario's Setup sets aside is not put into
      play by its setup keyword (MC40's reading; RRG "The Golden Rules", p. 4).
    - B: RRG step 11 as written for encounter set-aside cards too, with scenario 4 exempted by a scenario rule.
21. **Stryfe at 0 hit points when Living Bomb leaves play** (§3.34; "Stryfe cannot be defeated" ends; RRG "Defeat",
    p. 15: a character with zero or fewer remaining hit points is defeated).
    - **A (default):** that stage is defeated at once by the state check, with no defeating player and no "after you
      defeat" responses; the final stage's defeat wins.
    - B: he stays at 0 until damage is dealt to him again.
22. **Zero's When Defeated when no player defeated it** (40174: "If the player who defeated Zero does not have at
    least 3 cards of the same type in their hand, shuffle Zero into the encounter deck"; the sibling of Q2).
    - **A (default):** with no such player the condition is not met by anyone, so Zero is shuffled back.
    - B: the first player's hand is read. C: Zero is discarded.
23. **Psychic Inertia: which attacks and thwarts count as "your hero attacked and thwarted this phase"?** (§3.36)
    - **A (default):** any attack and any thwart made by your hero this phase: its basic powers and every ability
      labeled (attack) or (thwart) that your identity performs (RRG Appendix I, p. 49), not your allies'.
    - B: basic attack and basic thwart only.

**Pass 1c.**

24. **Who controls a campaign player side scheme?** (§3.43; MC40 pp. 9–18: "The players as a group choose … Put the
    chosen player side scheme into play". No player played it.)
    - **A (default):** nobody. Any hero or ally may thwart it; it stays in play when a player is eliminated; it is
      never discarded to a player's discard pile.
    - B: the first player at setup controls it, and it leaves play if that player is eliminated.
25. **Pouches after the game** (§3.48; Geared Up: "each player shuffles 1 copy of the Pouches resource card into their
    deck"; the environment returns with a new pouch counter every scenario, and only four copies exist).
    - **A (default):** the copy is in that player's deck for that game only; the campaign deck is unchanged, and
      Geared Up gives it again in each later scenario.
    - B: the first copy stays in the deck for the rest of the campaign, and later uses of Geared Up do nothing for a
      player who already has one.
26. **Is Malice an "attachment" while she is attached?** (§3.44; RRG p. 64: she "retains the minion card type" and
    "can be attacked and targeted by card abilities (including attachments) like any minion".)
    - **A (default):** she is a minion only. Player cards that attach to a minion can attach to her; an effect that
      chooses or discards "an attachment" cannot choose her.
    - B: she also counts as an attachment on that ally, so "discard an attachment" removes her.
27. **Malice: "Attached minion's SCH is equal to its THW"** (§3.44; 'Pool-ized and Beguiled print "its **printed** THW").
    - **A (default):** as printed: the ally's THW with the modifiers still applying to it (cards attached to it), read
      whenever its SCH is read.
    - B: its printed THW, as 'Pool-ized and Beguiled print it (treating the missing word as an omission).
28. **The Morlocks Saved search: before or after starting hands?** (§2.10; MC40 p. 11 gives no timing; RRG Appendix II
    step 14, p. 51: each player draws "until they have cards equal in number to their hand size".)
    - **A (default):** in the default campaign window, before starting hands: the searched card is part of the
      opening hand (the player draws one fewer) and may be kept or mulliganed.
    - B: after mulligans, as an extra card on top of the opening hand.

**Pass 2a.**

29. **Technovirus Purge: removers that are not characters** (§3.51: "Characters other than Cable cannot remove threat
    from Technovirus Purge"; E.V.A.'s Action, an encounter card that removes threat).
    - **A (default):** as written: only characters are barred. A support's or an encounter card's ability may
      remove threat from it; allies and other heroes (with their events and upgrades, RRG p. 49) may not.
    - B: only Cable may remove threat from it, by any means.
30. **Temporal Leap: how does the side scheme come back?** (§3.49, §3.54; RRG "Side Scheme", p. 40: "Each side scheme
    enters play with an amount of threat on it equal to the card's starting threat value".)
    - **A (default):** it enters play with its starting threat and is not revealed (no When Revealed, hinder or
      surge), then 4 threat moves onto it; a player side scheme is checked against the limit.
    - B: it enters with no threat of its own, holding only the 4 moved.
31. **Which discards are "from the top of your deck"?** (§3.55, §3.56: Jackpot!, Digging Deep, White Fox, The Painted
    Lady, Domino's doubling.)
    - **A (default):** any effect or cost that discards from the top of that player's deck, whoever's card causes it:
      a player card, an encounter card ("discard the top 5 cards of your deck"), a "discard until"; each card
      discarded is its own trigger.
    - B: only discards made by that player's own card abilities.
32. **Does a card still count for the ability that discarded it once a response has moved it?** (§3.55; A Good
    Workout discards Digging Deep, which goes to hand. April 30, 2026 - Ruling 4, answer 1 says a Digging Deep taken
    this way "does not count for the mission attempt".)
    - **A (default):** yes. "Discarded this way" is fixed when the card is discarded; its icons count, and the
      ruling is read as specific to mission attempts, which look at the discarded cards afterward.
    - B: no. A card its own response (or The Painted Lady) took away is not counted, following the ruling.
33. **A card with a discard response that was the deck's last card** (§3.55; MC40 p. 21 covers only Jackpot!, whose
    effect the reset already performs).
    - **A (default):** the response still resolves on the card where the reset put it: Digging Deep goes from the
      new deck to hand and White Fox into play, with no further shuffle (wave 3 §4 Q18's decision for "discard
      until").
    - B: the card is back in a deck, so the response cannot be triggered.
34. **A Good Workout's additional damage** (40040: "Deal 4 damage to an enemy … For each resource icon discarded this
    way, deal 1 additional damage to an enemy"; Right Place, Right Time prints "from that scheme").
    - **A (default):** as written: each additional point goes to an enemy the player chooses, the same one or
      another, as part of the same attack.
    - B: all of it goes to the enemy the 4 damage was dealt to.
35. **Superpower Feedback: what counts as resolving "an ability on your identity or an identity-specific card"?**
    (40069; `abilityResolved`.)
    - **A (default):** each triggered ability (action, response, interrupt, resource ability) on the identity or on
      an identity-specific card in play, and each identity-specific event played; not a basic power, not a constant,
      not spending such a card as a resource, not the obligation or nemesis cards.
    - B: basic attack, thwart, defense and recovery count as well.
36. **Back to the Future: can the Cable player damage the villain?** (§3.60: "The Cable player cannot damage enemies
    not engaged with them"; RRG "Engage", p. 18, speaks only of minions engaging a player.)
    - **A (default):** no. A villain is never "engaged with" a player, so while this scheme is in play the Cable
      player damages only minions engaged with them (the scheme isolates Cable until he clears it).
    - B: yes. The villain counts as engaged with every player; only other players' minions are out of reach.

**Pass 2b.**

37. **Soaring Hearts while the Angel player is Archangel** (41020 / 42021: "Team-Up (Angel and Psylocke) … Ready Angel
    and Psylocke"; RRG "Team-Up", p. 43: a friendly character "whose title or subtitle matches"; RRG "Identity",
    p. 23: a title "refers only to the identity with that title, and not to the other side of the card").
    - **A (default):** as written. Archangel is not titled Angel, so the card cannot be played while he is Archangel
      (or Warren Worthington III), and "Ready Angel" readies nothing that is not titled Angel. Deck legality is
      unaffected.
    - B: any face of the Angel identity counts as Angel for this card.
38. **A third restricted card made by a flip** (§3.64; RRG "Restricted", p. 38, says both "if a player ever
    controls more than two" and "Forced Response: After you take control of this card").
    - **A (default):** "ever": after any flip that leaves a player with more than two restricted cards they discard
      down to two, choosing only among cards that can leave play (never a permanent Psi-Katana).
    - B: the limit is checked only when a restricted card comes under a player's control, so a flip is never checked.
39. **Which cards hold the "[mental] resources on cards you control"?** (§3.65; Chimera 41026, Telekinetic Dragon 41029. RRG "Ownership and Control", p. 31: a player also controls the cards in their hand, deck and discard
    pile.)
    - **A (default):** cards in play under your control only (identity, allies, upgrades, supports, a Psi-Knife's
      showing face), printed [mental] icons only: the evident intent, since the whole deck would make X about a dozen.
    - B: cards in play and in your hand. C: p. 31 as written: hand, deck and discard pile too.
40. **Psionic Illusion's redirected attack** (§3.66: "name a resource type … change the target of this attack to a
    friendly character of your choice").
    - **A (default):** four types may be named, wild among them, and a printed wild matches only "wild"; any friendly
      character may be chosen, the attacker and other players' characters included; the attack keeps its damage and
      keywords, and "after you attack and defeat an enemy" responses find no enemy.
    - B: a printed wild icon matches any named type.
41. **Aerial Agility: whose attack?** (42004: "Hero Interrupt (defense): When an enemy attacks, if you are …"; RRG
    "Defense", p. 15.)
    - **A (default):** as written: any enemy attack, against any player or ally. Angel becomes the defender if the
      attack has none; with a defender already declared the card still resolves (boost ignored, or tough and
      retaliate 1 on Angel's hero) and the damage goes where it was going.
    - B: only an attack against you or a character you control.
42. **Which face answers an AERIAL event that changed the form?** (§3.62; Metamorphosis 42005 played as Angel into
    Archangel form.)
    - **A (default):** the face showing once the event has resolved: Angel of Death deals 2 (Metamorphosis's printed
      cost), Angel of Life is not offered. Each of the two abilities has its own once-per-phase limit (January 26,
      2026 - Ruling 6, answer 2).
    - B: the face that was showing when the event was played.
43. **Body Swapped on an upgrade that is already a Psi-Katana** (41025: "Flip each of your PSI-ENERGY upgrades to its
    Psi-Katana side and exhaust it").
    - **A (default):** every PSI-ENERGY upgrade ends on its Psi-Katana side and exhausted: one already showing
      Psi-Katana is not flipped, and is exhausted.
    - B: only the upgrades that were flipped are exhausted.

**Pass 2c.**

44. **May the players add the Dreadpool set to a game by choice?** (§3.74; the Deadpool insert calls it a "modular
    encounter set" and gives one way in: a player "using the 'Pool aspect". RRG FAQ p. 64: "only included if at least
    one player in the game chooses the 'Pool aspect".)
    - **A (default):** no. It is in a game exactly when a seat chose 'Pool, always then, and is never offered as a
      modular set or an optional extra.
    - B: it is also offered as an optional extra set (the Longshot treatment) for tables without a 'Pool deck.
45. **Deadpool would be defeated while he cannot change form** (§3.78: "instead set your hit point dial to 1, change
    to alter-ego form, and add 1 acceleration token"; a `cannotChangeForm` rule is in effect).
    - **A (default):** the replacement resolves as far as it can: the dial goes to 1, the token is added, and he
      stays in hero form.
    - B: a replacement that cannot be carried out in full does not replace, and he is defeated.
46. **How much damage may Maximum Effort and "Yoo-Hoo!" take?** (§3.79: "Take any amount of damage up to your
    remaining hit points →"; RRG "Cost", p. 14; the Focused Rage FAQ, p. 57.)
    - **A (default):** from 1 to the remaining hit points, all of it must be taken, and the card cannot be played
      while Deadpool holds a tough status card (the cost would be prevented). Taking every remaining hit point is
      legal: The Regeneratin' Degenerate then replaces the defeat and the event still resolves.
    - B: 0 may also be chosen (the event then does nothing, but counts as played).
47. **What is "your collection" in the app?** (§3.81; Armed to the Teeth 44009; RRG "Search", p. 39; Deadpool insert
    FAQ; December 17, 2025 - Ruling 4.)
    - **A (default):** every WEAPON upgrade in the app's playable card pool whose classification is one of the five
      aspects (no basic, identity-specific or campaign card), as long as a copy is left outside the game: its
      printed quantity in its product, less the copies in any seat's deck this game and any already fetched.
    - B: as A, with basic WEAPON upgrades as well. C: as A, with no copy accounting (always available).
48. **Git Gud's "if you did not win your previous game of Marvel Champions"** (§3.83; the insert: a forgotten game
    and a first game both count as not won).
    - **A (default):** the app remembers, per local profile, how that profile's last finished game ended; a loss, a
      conceded or abandoned game, or no game on record means the discount applies. In multiplayer each seat reports
      its own profile's flag at setup.
    - B: the player is asked at setup ("Did you win your last game?"). C: the discount never applies.
49. **Break Time's "heal 1 damage from each identity for every minute you were away from the game"** (§3.83).
    - **A (default):** a real break. Playing the card puts the table on a break screen with a running clock; when
      the players return, the whole minutes elapsed are the heal, reported to the engine as a number and logged.
    - B: no clock: the players type the number of minutes. C: a fixed heal of 5 (one comic's worth), no pause.
      D: the card is not legal in a digital deck.
50. **The Merc with the Mouth's "if you have not talked this phase"** (§3.83; the app cannot hear the table).
    - **A (default):** the honor system, as at a table: when the player phase ends the Deadpool player is asked
      "Did you talk this phase?" and the obligation is discarded on "No". In an online game the other players see
      the answer.
    - B: in an online game, any chat message or open microphone from that seat during the phase counts as talking;
      a solo game uses A. C: it is always discarded at the end of the first player phase it spends in play.
51. **Blackout and Tic-Tac-Toe: a wild resource, and a crisis icon** (§3.84: "an empty space above that matches the
    spent resource"; neither card prints a wild space; RRG "Wild Resource", p. 48; "Move", p. 30).
    - **A (default):** a wild is spent as the type its player declares, so it fills a space of that type. Moving
      threat off a scheme is removing it: a crisis icon, a patrol minion or "threat cannot be removed" stops
      Blackout taking it from that scheme. Moving damage off a character heals it, so "cannot be healed" stops
      Tic-Tac-Toe taking it from that character.
    - B: a wild matches no space; the rest as A.
52. **Is Laser Swords a restricted card?** (§3.82: "Counts as 2 restricted cards" on a card without the keyword;
    RRG "Restricted", p. 38: over the limit a player discards "restricted cards they control".)
    - **A (default):** it counts as two toward the limit and for any text that counts restricted cards, it may be
      the card discarded to get back under the limit, and it is found by text that looks for "a restricted card".
    - B: it only weighs on the limit: text that names restricted cards does not see it, and the cards discarded for
      the limit must carry the keyword.
53. **Plot Convenience used by another player** (44050: "Attach 1 aspect card from your hand facedown here … Add 1
    card attached facedown here to your hand. Any player may trigger this ability"; RRG "Ownership and Control",
    p. 31).
    - **A (default):** as written: the player who triggers it attaches a card from their own hand or takes any one
      attached card into their own hand, whoever owns it. A card in another player's hand is played by that player
      and goes to its owner's discard pile when it leaves play or is discarded.
    - B: a player may only take a card they own.

---

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`:** `CostedCard.costPerPlayer` (§1.3) and re-emit 44046; `next_evol`'s sets for this pass with
  §1.5–§1.9; read scans 40071a, 40074a, 40076a (0 or "—"), 40081a/b, 40105a/b; confirm player side scheme starting
  threat scaling (§1.1).
- **`ability-scripting-engineer`:** nothing until §3.2, §3.4, §3.7 land; then one agent per set (Marauders villains;
  `morlock_siege`; `on_the_run`; each modular set).
- **`encounter-ai-designer`:** the Routed sequence (§2.2) and Hope's Captor (§2.3) as scenario tests.
- **`rules-qa-engineer`:** fixtures for §3.1–§3.3 (limit at 2 and 3 players, defeat versus limit discard, assault with
  an ally) and the three rulebook-versus-RRG rows in §0.
- **`game-client-engineer`:** a player side scheme sits beside the main scheme; a per player cost shows multiplied in
  a game and "N per player" outside one; cards under Routed are inspectable.

### 5.1 Pass 1b's asks

- **`card-data-pipeline`:** §1.10–§1.16: Stryfe I's ATK 0★; 40173's THW −1 / ATK −1 stat box; `ownWhenRevealed` for
  40123 and 40169; 40154 as a treachery; the six typo corrections; `dashedThreatFields` for 40139b; the per-face
  fields of 40168a/b; Hope Summers (dash cost, star stats, setup keyword, `extraModular` set); scans 40140b–40143b,
  40167b, 40151, 40155, 40159 for threat values and stat boxes.
- **`ability-scripting-engineer`:** nothing until §3.25, §3.27, §3.28 and §3.32 land; then one agent per set (the
  three villains with their main schemes; `juggernaut`; `mister_sinister`; `stryfe`; `hope_summers`; each of the six
  modular sets). The stage 2Bs' "When Completed" advance is not scripted (§3.28).
- **`encounter-ai-designer`:** scenario tests for the Juggernaut completion loop (§3.23), the Sinister Experiments
  order in standard and expert setup (§3.28, MC40 p. 21), and the Stryfe's Grasp / Living Bomb sequence from both
  triggers (§3.34).
- **`rules-qa-engineer`:** fixtures for MC40 p. 21's Stryfe example (§3.32), ruling January 26, 2026 - Ruling 4 (4)
  (§3.33), ruling July 9, 2026 - Ruling 3 (1) (§3.37), Hope Summers leaving play by each route (§3.25), and the §0
  row on the setup keyword.
- **`game-client-engineer`:** momentum counters on the villain with the ATK they add; Hope Summers marked as the
  first player's and as a loss condition; the removed and the unrevealed Sinister Experiments; a card type picker for
  Psychic Override; the "most common type" count shown per player during Stryfe's attack and step one.

### 5.2 Pass 1c's asks

- **`card-data-pipeline`:** the `next_evol_campaign` set per §1.20 (the six b faces as their own environment records
  with `otherFaceId` both ways; the dash cost and 4 per player threat of the a faces; Malice's "Treat"; the remaining
  scans); `NEXT_EVOL_CAMPAIGN` per §1.19 with `prohibited.cardIds: ["40204"]`; `startingVillain: "bySetup"` on On the
  Run once §1.21 lands.
- **`game-rules-architect`:** §1.21 with §3.42, then §3.40, §3.41, §3.43, §3.44 and §3.47, one agent each. §3.43
  needs §3.2 (the limit) first.
- **`ability-scripting-engineer`:** the campaign set's abilities (§3.48; Malice after §3.44), then
  `campaigns/next_evol.ts` (§2.10, §3.45) with the shared expert helpers (§3.46), after all five scenarios are
  scripted. One agent for the cards, one for the definition.
- **`rules-qa-engineer`:** the RRG p. 64 Malice fixture (five bullets); a full campaign run with a retry of one
  scenario in which the scheme was defeated in the lost game (nothing earned, same scheme, no prompt); scenario 2
  after scenario 1 in the other mode (the recorded villains still leave); a seat eliminated in a won expert game.
- **`game-client-engineer`** (for the later client step; no design here):
  - **Campaign log screen:** per seat identity and, in an expert campaign, remaining hit points; Marauders Defeated
    (three titles); Morlocks Saved (a number); Hope Summers's damage for scenarios 3 and 4; the six-row table (player
    side scheme, scenario chosen, encounter card, environment, earned), with a row removed from the campaign shown as
    such.
  - **Briefing, every scenario:** choose one campaign player side scheme from the rows not yet chosen, with both
    faces and the paired encounter card inspectable before choosing (MC40 p. 7); on a retry the choice is shown as
    already made, not offered (§3.40).
  - **Briefing, what carries in:** the earned environments and what each adds to this scenario (a tough status card
    on each enemy, a momentum counter, threat); the encounter cards added so far; in scenario 2 the villains out of
    the draw and the number of Morlock searches.
  - **In-game setup choices** (ordinary choice frames, listed so the setup pacing accounts for them): which player
    takes each Morlock search; Hope Summers's damage or threat (scenarios 4 and 5); each seat's expert heal.
  - **Table:** a campaign player side scheme beside the main scheme and its flip to an environment; environment
    counters and their Action; Malice shown attached to the ally she possesses, with that ally on the enemy side.
  - **Scenario 3's modular sets:** Black Tom Cassidy is fixed in the campaign and not offered for swapping.
  - **Deck editing between scenarios:** Hope Summers (40204) is refused with the campaign's reason; campaign cards
    are never offered.
  - **Rewind and finale:** the retry text says the scheme must be re-earned; scenario 5 lost in an expert campaign
    ends the campaign.
  - `docs/campaign-client-per-box.md` §3's MC40 row needs the correction noted in §0 (no Completed/Failed sides).

### 5.3 Pass 2a's asks

- **`card-data-pipeline`:** the four fixes in §7.1; nothing else (both precons, both nemesis sets and the reprints
  are emitted).
- **`game-rules-architect`:** §3.49, §3.50, §3.51, §3.55, §3.56 and §3.59, one agent each; §3.55 before §3.56.
- **`ability-scripting-engineer`:** per hero, wave 6's split (identity; events; supports, upgrades and allies;
  obligation and nemesis; precon e2e). Cable needs §3.1, §3.2 and §3.49–§3.51 first; Domino §3.55 and §3.56. The
  aspect and basic cards are a fifth module per deck, and most of them wait on nothing (§3.61).
- **`rules-qa-engineer`:** the five MC40 p. 21 entries as fixtures (E.V.A. without Fantomex; Technovirus Resurgence
  at the limit, both choices; Domino's doubled wild through Luck Be a Lady; Diamondback at 1 hit point; Jackpot! as
  the last card), Stryfe canceling a PSIONIC event with Psimitar in play, and illegal-deck tests for §7.1.
- **`game-client-engineer`:** the victory display's side scheme count shown on Cable's cards that read it; cards
  attached facedown to The Painted Lady visible to their owner only; the discarded card shown before a "per icon"
  effect resolves, with a doubled wild marked.

### 5.4 Pass 2b's asks

- **`card-data-pipeline`:** the fixes listed in §7.2; `HeroFace.schemeIcons` and the emission of `schemeIcons` for
  cards that are not schemes (§3.63); `PlayRestrictions.requiresIdentityAnyTrait` (§3.71) once the architect lands the
  field.
- **`game-rules-architect`:** §3.62, §3.63, §3.64, §3.66, §3.67, §3.68 and §3.69, one agent each; §3.69 with §3.59
  (one filter serves both); §3.71's field with its check in `actions.ts`.
- **`ability-scripting-engineer`:** per hero, wave 6's split. Psylocke's identity and upgrades wait on §3.64, her
  nemesis set on §3.65 and §3.66; Angel's identity and Metamorphosis on §3.62. Most events, the aspect cards and the
  basics wait on nothing (§3.72). The four reprints go in the wave's `reprints.ts`.
- **`rules-qa-engineer`:** Psi-Energy Control on each basic power (Knife to Katana on an attack: +1 ATK and
  piercing for that attack); RRG p. 20's Flurry of Blades example; Body Swapped with a Katana already showing, and
  the Katana's "You may flip" refused while it is in play; all six form changes of Angel, the once-per-round change
  spent by a hero-to-hero change; Archangel's acceleration icon counted only on that face; Soaring Hearts refused
  as Archangel (Q37); illegal-deck tests from §7.2.
- **`game-client-engineer`:** a three-way form control for Angel (the Ant-Man control, faces told apart by title);
  the Psi-Knife / Psi-Katana pair shown with the face up and an inspectable other face; the acceleration icon on
  Archangel's face counted in the threat preview; "if you are" events showing which branch will resolve.

### 5.5 Pass 2c's asks

- **`card-data-pipeline`:** the fixes listed in §7.3 (the printed icons of eight 'Pool cards first: §3.77 reads
  them); `EncounterSet.autoIncluded` on `dreadpool` (§3.74) and `PlayerCard.restrictedWeight` on 44055 (§3.82) once
  the architect lands the fields; 44046's per player cost (§1.3, asked since pass 1a).
- **`game-rules-architect`:** §3.74, §3.75, §3.76, §3.77, §3.79, §3.80, §3.81, §3.82 and §3.83, one agent each.
  §3.76 before §3.80; §3.83 after the answers to Q48–Q50.
- **`ability-scripting-engineer`:** per hero, wave 6's split. X-23's identity, events and upgrades wait on nothing
  but the verifies of §3.85 and §3.86; her Aggression and basic cards wait on §3.1–§3.3 (the three player side
  schemes), §3.75 (the Specialists) and §3.55–§3.56 (Rictor). Deadpool's identity is §3.78; his events and
  resources wait on §3.76, §3.79 and §3.80, Armed to the Teeth on §3.81. The 'Pool aspect is its own module (34
  cards), most of it waiting only on §3.77; the Metagame upgrades compose (§3.84, §3.87). The `dreadpool` set is one
  agent, after §3.74. The eight reprints go in the wave's `reprints.ts`.
- **`encounter-ai-designer`:** a scenario test of the Dreadpool sequence: Crisis revealed, Dreadpool engaging the
  first player, Dreadful Deeds counting 'Pool players, the remaining four cards shuffled in, Dreadpool dealt
  facedown to whoever defeats him and returning.
- **`rules-qa-engineer`:** the RRG p. 64 fixtures (Honey Badger defeated by the damage; Crisis absent when 'Pool
  cards come from outside a chosen aspect, present when 'Pool is chosen, one copy with two 'Pool seats); the seven
  Deadpool insert FAQ entries, one test each; the four rulings of §0; Maximum Effort for every remaining hit point
  into The Regeneratin' Degenerate; a token never counted as an icon and the reverse; Front Line Specialist's +4
  hit points in alter-ego form; two decks with Specialized Training; illegal-deck tests from §7.3.
- **`game-client-engineer`:** 'Pool as a fifth aspect in the deck builder, pink, with the notice that choosing it
  adds Crisis of Infinite Deadpools to every game; the acceleration token count on the main scheme and the total of
  the four icons in play, shown on the cards that read them; the icons printed on 'Pool allies and upgrades marked
  as live; a number picker for "take any amount of damage" with the damage and the result previewed, and a warning
  when the pick is every remaining hit point; the collection browser for Armed to the Teeth and the facedown card
  under it; the set-aside Specialists shown to each player who may choose one; Blackout's six spaces and
  Tic-Tac-Toe's grid drawn on the card with their tokens, and Rock, Paper, Scissors' diagram shown beside the two
  cards it compares; the break screen (Q49) and the "Did you talk?" prompt (Q50); Honey Badger shown facedown under
  Self-Isolation.

## 6. Later passes (placeholders)

- **(pass 2a)** Written: §7.1, §3.49–§3.61, questions 29–36. Technovirus Resurgence is §3.53.
- **(pass 2b)** Written: §7.2, §3.62–§3.72, questions 37–43.
- **(pass 2c)** Written: §7.3, §3.73–§3.87, questions 44–53. 'Pool-ized is §3.44's table, with one scripted test.
- **(pass 3)** Written 2026-10-04: §8. The queue is 50 tasks (§8.2); only tasks 49 (§3.81, Q47) and 50 (§3.83,
  Q48–Q50) wait for an answer. The dependencies earlier passes listed here are carried into §8.2's "after N" notes:
  §3.43 item 1 → §3.2 → §3.49 → §3.53 (a script); §3.8 → §1.21 with §3.42 and §3.13; §3.12 and the flip-and-reveal
  task → §3.34; §3.4 → §3.47; §3.50 → §3.55 → §3.56; §3.59 with §3.69; §3.62 → §3.63; §3.64 → §3.82; §3.76 → §3.80;
  §3.1 → §3.63, §3.75 and §3.77.
- **Still to do after pass 3:** the owner's answers to §4.2 (order in §8.4), then §4.1's table; the main session
  decides the two status flips proposed in §8.6.

## 7. Pass 2: hero packs

### 7.1 Pass 2a: Cable, Domino and the box's player cards

Read 2026-10-04: every record 40001a–40069 and 40204 of the emitted `packages/content/src/data/next_evol/cards.ts`;
scans 40001b, 40006, 40012, 40037a/b, 40045, 40053; MC40 pp. 21–22. Both precons match p. 22's lists (40 cards each).

| Identity                       | Obligation                     | Nemesis set (nemesis minion in bold)                                                                      | Setup, hand size, precon                                                                                                                                                                           |
| ------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cable / Nathan Summers (40001) | Technovirus Resurgence (40031) | **Stryfe** (40032, villainous), Back to the Future, Telekinetic Force Field, Mind Scan, Telekinetic Blast | Soldier X Setup: a player side scheme from deck or discard pile into play. 5 / 6, REC 4, 12 hit points. Leadership, 40 cards, with Lock and Load (Aggression) and Establish Perimeter (Protection) |
| Domino / Neena Thurman (40037) | Memories of Armageddon (40065) | **Topaz** (40066), Not My Lucky Day, Prototype, Superpower Feedback ×2                                    | No Setup. 5 / 6, REC 3, 9 hit points. Justice, 40 cards                                                                                                                                            |

**Cable: player side schemes as an engine.** Nathan Summers puts one into play at setup (MC40 p. 22 recommends
Technovirus Purge, whose 5 threat only Cable removes, §3.51) and Professor fetches the next. Defeating a side scheme
readies Cable once per phase (§3.52), readies Graymalkin and draws through Mission Leader. Each side scheme in the
victory display, player or encounter (Forced Amnesia sends an encounter one there, §3.49), adds to Mind Scan,
Telekinetic Blast, Plasma Rifle and Precognition, and to the nemesis set's Mind Scan and Telekinetic Blast against
him. Technovirus Purge in the victory display makes him PSIONIC with +1 to each stat (§3.50); Technovirus Resurgence
pulls it back into play (§3.53, MC40 p. 21). Temporal Leap spends a scheme from the victory display to stop a main
scheme stage completing (§3.54). The nemesis Stryfe (40032) is not the scenario's villain Stryfe (40163–40165): the
same title, so RRG "Unique Icon" (pp. 45–46) and §4.2 Q4 apply when both would be in play.

**Domino: the top of the deck.** Her hero Action swaps a hand card onto the deck (§3.57) so the next "discard the top
card of your deck" finds it; each such card counts its printed resource icons, a wild twice (§3.56, MC40 p. 21).
Jackpot! (three icons) shuffles itself back, Digging Deep returns to hand, White Fox enters play (§3.55), and The
Painted Lady banks up to three discarded cards for an alter-ego turn (§3.58). Neena Thurman's swap reaches the top
of the discard pile instead. Lucky Break and Lucky and Good cancel a revealed card and a boost card (§3.61).
Memories of Armageddon blanks both faces until she exhausts in alter-ego form (§3.19); Superpower Feedback taxes
each identity ability (§4.2 Q35).

**The aspect and basic cards.** Leadership's X-FORCE allies and Uncanny X-Force, Justice's side-scheme events (Team
Investigation with its per player cost, §3.4), six ordinary player side schemes across four aspects and basic
(§3.1), and the basic allies Deadpool, Deathlok, Atlas Bear, White Fox and Hope Summers (40204; not the campaign's
Hope Summers 40130, and barred from campaign decks, §1.19). All in §3.61's table.

**Card data fixes** (for `card-data-pipeline`):

- The Painted Lady 40045: emitted "from the top of **the** deck"; the scan prints "from the top of **your** deck".
- Telekinetic Force Field 40012: emitted "Hero form only" with no period and as an ability ref
  (`40012.telekinetic-force-field-constant`), with no `playRestrictions.form: "hero"`. The scan prints "Hero form
  only." (RRG "Form", p. 21: it can only be played or put into play in hero form; `actions.ts` enforces the field).
- Overwatch 40055 (and its original 30019): "Max 1 per scheme." is not parsed (`parse-text.ts`'s "Max N per" host
  list has no "scheme"), so neither record has `playRestrictions.maxPerHost: 1` and two can be attached to one
  scheme today.
- Sharpshooter 40064: "Max 1 per player." and the Hero Interrupt are on one line of the emitted text (the field
  `maxPerPlayer: 1` is right).
- Team Investigation 40053 still has `cost: 2` and no `costPerPlayer` (§1.3, already asked in §5).

**Deckbuilding (DoD §4b).**

- Nathan Summers: "You may include player side schemes from any aspect in your deck." Emitted as
  `offAspectAllowance { cardType: "player_side_scheme" }`. Illegal-deck test: an off-aspect non-scheme card in a
  Cable deck; legal: Lock and Load and Establish Perimeter in his Leadership deck.
- Team-Up (RRG p. 43): Frenemies (40026) only in a Cable or Deadpool deck, max 1 per deck.
- "Max 1 per deck": The Posse (40058), Energy, Genius, Strength. Each player side scheme is unique, limit 1.
- "Play only if" lines are play restrictions, not deckbuilding: Mission Planning (a side scheme in the victory
  display), The Posse (three POSSE characters you control; Domino's hero face is one).
- Hope Summers (40204) is legal in standalone decks and `prohibited` in the MC40 campaign (§1.19).

### 7.2 Pass 2b: Psylocke and Angel

Read 2026-10-04: every record of `packages/content/src/data/{psylocke,angel}/cards.ts` (33 and 32 card codes) against
the raw caches; the scans and both inserts listed in §0; both emitted starter decks.

| Identity                                                | Obligation                    | Nemesis set (nemesis minion in bold)                                                   | Setup, hand size, precon                                                                                                                                                 |
| ------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Psylocke / Betsy Braddock (41001)                       | Body Swapped (41025)          | **Chimera** (41026), Interdimensional Plunder, Psionic Illusion, Telekinetic Dragon ×2 | Betsy Braddock's Setup: both Psi-Knife / Psi-Katana (41002a/b, permanent) into play, Knife side up. 4 / 6, REC 3, 10 hit points. Justice, 40 cards plus the 2 permanents |
| Angel / Warren Worthington III / Archangel (42001a/b/c) | Apocalyptic Influence (42024) | **Harpoon** (42025), Hook, Line, and Sinker, Harpoon's Harpoon, Spear Shot ×2          | No Setup; starts as Warren Worthington III. Angel 5, Archangel 5, alter-ego 6; REC 3, 12 hit points. Protection, 40 cards                                                |

Each pack also carries cards outside its starter deck: Psi-Bow Attack (Aggression), Domino (Leadership), Psi-Flail
Strike (Protection) and Telekinesis (basic) in Psylocke's; Bombs Away (Aggression), Eyes in the Sky (Justice), Flying
Formation (Leadership) and X-Force Recruit (basic) in Angel's.

**Psylocke: two blades, each with two faces.** Both PSI-ENERGY upgrades start in play and never leave (permanent).
Psi-Knife gives +1 THW and a [mental] resource; Psi-Katana gives +1 ATK, piercing on her basic attacks, a [physical]
resource, and is restricted. Three things flip one: paying with it ("You may flip this card"), Psi-Energy Control when
she uses a basic power (the star printed on her THW, ATK and DEF; §3.64), and Body Swapped, which forces both to
Katana, exhausts them and locks them there until she discards a PSIONIC card in alter-ego form. Her four events each
do a base effect plus one thing per Knife and another per Katana, counted as the event resolves (the Psylocke insert:
"which PSI-ENERGY weapons she has faceup when the event is played"; RRG p. 20 uses Flurry of Blades as its "for each"
example). Two Katanas fill the restricted limit, so any other restricted upgrade competes with them (Q38). The three
SKILL upgrades (Martial Arts, Psionic and Weapons Training) each give a constant until discarded for a one-time
response, and Training Regimen (a support with the TRAINING trait) fetches them. None of the three upgrades has the
TRAINING trait, and no card here prints a "max per" on it, so wave 6's `maxWithTrait` is not used by this pack. Her
nemesis set reads the [mental] icons she has in play (Q39) and turns her own attack on a friend (§3.66).

**Angel: one alter-ego, two hero faces.** A foldable three-sided card, the Ant-Man shape and not MC32's additional
forms (§0; §3.62). Angel (THW 2, ATK 1, DEF 2) draws a card after an AERIAL event; Archangel (THW 0, ATK 2, DEF 3,
with a printed acceleration icon, §3.63) deals that event's printed cost as damage; each once per phase. He changes
among the three faces with his one voluntary change each round, with Metamorphosis (any other face, then an effect by
the face reached) and against his will with Apocalyptic Influence (to Archangel, or 2 threat if already there). His
AERIAL events and Techno-Organic Wings read "if you are Angel / Archangel" by the face's title, since both faces
print the same traits. Avian Anatomy returns an AERIAL event to hand after it resolves (§3.68), and Worthington
Industries recycles one from the discard pile. The nemesis Harpoon hits AERIAL characters harder and makes BRUTE
attacks indirect; Warren Worthington III is not AERIAL, so the alter-ego face is out of his reach.

**Soaring Hearts** (41020, reprinted as 42021) is the pair's Team-Up: wave 6's `teamUp` keyword and the deck rule in
`docs/team-ups.md`. It names "Angel", which the Archangel face is not (Q37). Each deck holds the other hero as a
signature ally (Angel 41003, Psylocke 42002), so the card is playable by one deck alone.

**Elixir (42011)** is the pack's either-trait restriction: scripted as a `playOnlyIf` constant, with a data field
proposed (§3.71).

**Card data fixes** (for `card-data-pipeline`; scan against emitted text):

- Archangel 42001c: the printed acceleration icon is not emitted (raw `scheme_acceleration: 1`). Needs
  `HeroFace.schemeIcons` (§3.63).
- Apocalyptic Influence 42024: the printed hazard icon is not emitted (raw `scheme_hazard: 1`;
  `BaseCard.schemeIcons` exists).
- Psi-Katana 41002b: the flip side has no resource icon. The scan prints [physical] and raw 41002b has
  `resource_physical: 1`; the front's `resourceIcons: { mental: 1 }` is right for Psi-Knife. Chimera and Telekinetic
  Dragon read it (§3.65).
- Psi-Flail Strike 41032: emitted (and raw) "Play only if your **hero** has the PSIONIC trait"; the scan prints
  "your **identity** has". It should be `playRestrictions.requiresIdentityTrait`, with no
  `41032.psi-flail-strike-constant` ability ref.
- Telekinesis 41033: the same error ("hero" for the scan's "identity"), so `requiresIdentityTrait` is missing and
  `41033.telekinesis-constant` is a stray ref; `maxPerPlayer: 1` is right.
- Psi-Bow Attack 41030: the scan does print "your hero has the PSIONIC trait". `parse-text.ts` has no rule for that
  sentence, so it is a constant ability ref; parse it as `form: "hero"` plus `requiresIdentityTrait` (the Giant /
  Tiny rule's shape), or leave it to a `playOnlyIf` script. Say which.
- Containment Strategy 42019: "Max 1 per side scheme." is not parsed (the Overwatch gap of §7.1), so there is no
  `playRestrictions.maxPerHost: 1` and `42019.containment-strategy-constant` is a stray ref.
- Elixir 42011: `42011.elixir-constant` is correct for now (§3.71). Its text is emitted "X-Force or X-Men" and Ever
  Vigilant 42015's "aerial trait" in lower case, where every other trait in these files is upper case.
- Warpath 42013: emitted "(paying its cost)"; the scan prints "(paying its costs)".
- Psylocke 41001a: raw `thwart_star`, `attack_star` and `defense_star` are true and the scan prints a star on all
  three; `HeroFace` has no star fields. The ability text carries "[star]", so this is display only; Elixir's THW and
  ATK stars (42011) are the same case.
- Angel 42001a: `collectorNumber: "1A/1B"` for a card whose faces are 1A, 1B and 1C.
- Render Medical Aid 42017: the pack's printed decklist card calls entry 17 "Triage" (the starter deck's provenance
  note); the card and raw data say Render Medical Aid, which is right.

**Deckbuilding (DoD §4b).**

- Permanent cards "do not count towards a player's minimum or maximum deck size" (RRG p. 32): Psylocke's starter list
  has 42 entries and is a legal 40-card deck. Test: the precon validates; a 39-card deck plus the two permanents does
  not.
- Team-Up (RRG p. 43): Soaring Hearts only in an Angel or Psylocke deck, max 1 per deck, either printing (41020 and
  42021 are one card).
- Neither identity prints a deckbuilding line. "Play only if your identity has the X-FORCE / PSIONIC / AERIAL trait"
  (Pete Wisdom, IPAC, Telepathy, Telekinesis, Psi-Flail Strike, Ever Vigilant, X-Force Recruit, Elixir) are play
  restrictions, legal in any deck. Betsy Braddock is PSIONIC but not X-FORCE, and Warren Worthington III is neither
  AERIAL nor X-FORCE: test each card refused in alter-ego form and accepted in hero form.
- Unique: the Angel ally (41003) cannot be in an Angel deck, nor the Psylocke ally (42002) in a Psylocke deck (RRG
  "Unique Icon", pp. 45–46: the identity is included in the evaluation).
- Each player side scheme (Lay the Trap, Render Medical Aid) is unique, limit 1.

### 7.3 Pass 2c: X-23 and Deadpool

Read 2026-10-04: every record of `packages/content/src/data/{x23,deadpool}/cards.ts` (40 and 58 card codes) against
the raw caches; the scans and both inserts listed in §0; both emitted starter decks (counted, not checked against
the printed decklist cards, which the inserts do not carry).

| Identity                       | Obligation                      | Nemesis set (nemesis minion in bold)                                                              | Setup, hand size, precon                                                                                                                                                 |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| X-23 / Laura Kinney (43001)    | Self-Isolation (43028)          | **Lady Deathstrike** (43029), In the Name of Vengeance, Cybermods, Critical Wound, Hack 'n' Slash | Laura Kinney's Setup: X-23's Claws (43002, permanent) into play. 5 / 6, REC 6, 10 hit points. Aggression, 40 cards plus the permanent; four linked Specialists set aside |
| Deadpool / Wade Wilson (44001) | The Merc with the Mouth (44032) | **Butler** (44033), Involuntary Procedures, Tabula Rasa 16, Mutated Soldier ×2                    | No Setup. 5 / 6, REC 8, 9 hit points. 'Pool, 40 cards; the `dreadpool` set comes with the aspect (§3.74)                                                                 |

Each pack also carries cards outside its starter deck: Predictable Ploy (Justice), Rally the Troops (Leadership) and
Anticipated Attack (Protection) in X-23's; sixteen more 'Pool cards (44043–44058) in Deadpool's.

**X-23: damage is her resource.** THW 2, ATK 1, DEF 2, and she readies once each phase after taking any damage
(§3.85), so a defended villain attack gives her a second action and X-23's Claws (take 2 damage for +2 ATK this
round) or Grim Resolve (take 1 for a [wild]) ready her on her own turn. Honey Badger readies her again each time
Honey Badger is damaged and survives (RRG FAQ p. 64); Sisterly Bond and Claw Mastery lean on her being in play, and
Laura Kinney's Action and Sisterhood bring her back. Pain Tolerance and Regenerative Longevity pay for the damage,
REC 6 does the rest. Self-Isolation hides Honey Badger under itself until Laura makes a basic recovery (§3.86). The
nemesis set punishes attacking (retaliate 1 on every enemy) and a full hand of resources (Hack 'n' Slash).

**The Aggression deck around her** thwarts by attacking: Keep Them Busy is a player side scheme with assault that
removes 5 per player threat from the main scheme when it falls, and The Direct Approach gives assault to any
non-permanent side scheme (§3.3). Specialized Training hands every player one of four linked upgrades that exist
nowhere else (§3.75). Critical Hit, Predictable Ploy and Anticipated Attack only play once a side scheme is in the
victory display, the cycle's shared condition (§3.49). Boom Boom and Rictor are new cards under titles wave 6
already scripted (§3.87).

**Deadpool: he does not stay down.** THW 2, ATK 2, DEF 1, 9 hit points. Defeated in hero form he goes to 1 hit
point, alter-ego form and one more acceleration token on the main scheme (§3.78); Wade Wilson's REC 8 puts him back.
His cards spend hit points on purpose: Maximum Effort and "Yoo-Hoo!" take any amount of damage for as much damage or
threat removal (§3.79), This Card is Fire deals the damage he has sustained and burns him while it sits in hand, and
Deadpool's Katana costs 1 damage a swing. The tokens his deaths add are a clock he also profits from: Cable, Montage,
Exhausting Personality and It Ain't Over... all scale with them (§3.76, §3.80). Armed to the Teeth fetches a weapon
from outside the game (§3.81). His obligation exhausts his allies and silences the other players until he keeps
quiet for a player phase (§3.83); his nemesis Butler feeds a side scheme that grows each time Deadpool is damaged,
and Tabula Rasa 16 blanks his identity, the one thing that makes his defeat real.

**The 'Pool aspect** (34 cards, pink) is a fifth aspect any hero may choose (§3.73), and choosing it puts Crisis of
Infinite Deadpools in the encounter deck (§3.74). Its allies take no consequential damage (every one prints 0 / 0)
and most print an encounter icon that is live while they are in play; its payoffs count the crisis, acceleration,
amplify and hazard icons on the table (§3.77), so the aspect grows stronger as the board grows worse. Live
Dangerously is a player side scheme with all four icons, no When Defeated and +2 hand size for everyone: a scheme
the players want to keep. The three Self resources double or triple while the identity is healthy (§3.80), Laser
Swords fills both restricted slots by itself (§3.82), and Plot Convenience is a shared three-card bank.

**Cards that step outside the game's frame.** Said plainly, card by card:

| Card                                               | What it asks                                                                  | A digital game can                                               | It cannot                                           | Decision |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- | -------- |
| Git Gud 44028                                      | "if you did not win your previous game"                                       | remember how a profile's last game ended and pass it in at setup | know whose game the last one on a shared device was | Q48      |
| Break Time 44046                                   | leave the table; 1 heal per minute away                                       | pause the table and time the pause                               | know that anyone left, or read a comic              | Q49      |
| The Merc with the Mouth 44032                      | "if you have not talked this phase"                                           | ask; in an online game, see chat or an open microphone           | hear a table                                        | Q50      |
| Armed to the Teeth 44009                           | "search your collection"                                                      | offer the app's whole card pool                                  | know which cards a player owns                      | Q47      |
| Blackout 44053, Tic-Tac-Toe 44057                  | tokens placed on spaces printed in the art                                    | model each space as a named counter and draw it                  | read the art: the layouts are recorded in §3.84     | Q51      |
| Rock, Paper, Scissors 44056                        | a "beats" diagram printed in the art                                          | apply the relation recorded in §3.87                             | —                                                   | none     |
| Laser Swords 44055                                 | "Counts as 2 restricted cards"                                                | weigh it as two (§3.82)                                          | —                                                   | Q52      |
| War 44058, Mulligan 44048, This Card is Fire 44012 | a card game inside the card game; a new hand; a card that hurts from the hand | play them as written: all three compose (§3.87)                  | —                                                   | none     |

**Card data fixes** (for `card-data-pipeline`; scan or raw against emitted):

- **Printed encounter icons are missing on seven 'Pool cards** (`BaseCard.schemeIcons`; the engine already counts
  them, §3.77): Dogpool 44013 (scan read), Kidpool 44015 and Bob, Agent of Hydra 44043 an acceleration icon (raw
  `scheme_acceleration: 1`); Negasonic Teenage Warhead 44044 and Pandapool 44045 a hazard icon (raw
  `scheme_hazard: 1`); Ambush 44051 and Distraction 44054 a crisis icon (raw `scheme_crisis: 1`). Headpool, Lady
  Deadpool and Dreadful Deeds carry `amplifyIcons: 1` correctly.
- Live Dangerously 44024: the scan prints all four icons (crisis, acceleration, amplify, hazard; raw has all four
  flags); only `amplifyIcons: 1` is emitted. Needs §1.1's icons on a player side scheme.
- Break Time 44046: the scan prints a cost of 3 per player (raw `cost_per_hero: true`); emitted `cost: 3` with no
  `costPerPlayer` (§1.3).
- "I Got This" 44021: the four icon lines are emitted as four constant ability refs (`44021.i-got-this-constant` to
  `-constant-4`). They are the body of the one Hero Action.
- Laser Swords 44055: "Counts as 2 restricted cards. Max 1 per deck." is emitted as `44055.laser-swords-constant`;
  it becomes `restrictedWeight: 2` (§3.82), leaving one constant (the ATK line).
- Plot Convenience 44050: "Any player may trigger this ability." is emitted as `44050.plot-convenience-constant`; it
  is part of the Action (`triggerableBy`).
- Ambush 44051 ("Max 1 per side scheme.") and The Direct Approach 43020 ("Limit 1 per side scheme."): not parsed
  (the Overwatch gap of §7.1, here with "Limit" as a second wording), so neither has `playRestrictions.maxPerHost:
1` and each carries a stray constant ref.
- `dreadpool` (`deadpool/encounterSets.ts`): needs `autoIncluded` (§3.74); until then nothing marks it as
  conditional, and a scenario could list it as a modular set.
- Correct as emitted, noted so nobody "fixes" them: Deadpool 44001a's THW 2, ATK 2, DEF 1 (the scan's "200\*" is the
  joke); Wade Wilson's MUTANT trait; Front Line Specialist 43036 and 'Pool-ized 44041 with their errata; the
  `*-constant` refs of Critical Hit 43016, Predictable Ploy 43038, Anticipated Attack 43040 and Mulligan 44048,
  which are `playOnlyIf` scripts; the star stats of Rictor, Shatterstar, Cable, Headpool, Kidpool, Butler and
  Mutated Soldier (display only, as Psylocke's in §7.2).

**Deckbuilding (DoD §4b).**

- 'Pool is a legal choice for any identity (§3.73). Tests: the Deadpool precon validates with `aspects: ["pool"]`;
  a 'Pool card in an Aggression deck is `aspect_restriction`; a two-aspect identity may take 'Pool as one of its
  aspects, and Adam Warlock may take it in place of any one of his four (Deadpool insert FAQ).
- Linked (RRG p. 27; August 3, 2026 - Ruling 4, answer 3): the four Specialists are refused in any deck
  (`linked_card`) and set aside for each deck that holds Specialized Training.
- Permanent (RRG p. 32): X-23's Claws is not counted; her starter list has 41 entries and is a legal 40-card deck.
- "Max 1 per deck": Cutupper, Da Bomb, Get Rage-y, Not my Responsibility, 'Pool Inspection, Self Confidence, Self
  Control, Self Preservation, Stick-To-Itiveness, Break Time, Get in Front of Me!, Laser Swords, Energy, Genius,
  Strength. "Max 2 per deck": Bazooka. Each player side scheme and each Metagame upgrade is unique, limit 1.
- Team-Up (RRG p. 43): Frenemies only in a Cable or Deadpool deck, either printing (44031 and 40026 are one card).
- Unique: the basic ally Deadpool (40024) cannot be in a Deadpool deck; Cable (44002) is Deadpool's signature ally
  and cannot enter play beside a Cable identity.
- Neither identity prints a deckbuilding line. "Play only if there is a side scheme in the victory display" and
  IPAC's X-FORCE line are play restrictions; X-23 is X-FORCE in hero form only, Deadpool likewise.
- The Dreadpool gate reads the declared aspect, not the cards (RRG FAQ p. 64): a deck that holds 'Pool cards
  through an off-aspect allowance or a campaign grant does not bring Crisis of Infinite Deadpools.

---

## 8. Build order (pass 3)

Written 2026-10-04 from §3's status lines and Plan paragraphs, with each status checked against the code at HEAD
0847f557 (nothing of this wave's engine work has landed: none of the identifiers the plans name exist in
`packages/engine/src`, `packages/cards/src/dsl` or `packages/content/src/schema`). §3's statuses are not changed
here; the two disagreements found are in §8.6.

One queue task per agent and per commit. **At most one engine agent at a time** (`packages/engine`,
`packages/cards/src/dsl`, and `packages/content/src/schema` for a schema change); beside it, at most two other agents
on disjoint files (data fixes, card scripts, campaign definition, tests). A scenario, hero or set is scripted only
once every queue task it needs has landed. The box first, in the order its content is scripted (the cross-cutting
rules, then Morlock Siege, On the Run, Juggernaut, Mister Sinister, Stryfe, then Cable, Domino, then the campaign),
then Psylocke, Angel, X-23 and Deadpool.

### 8.1 Status of every §3 row

"compose" means existing vocabulary, nothing to verify beyond the script's own tests. "exists (verify)" rows are
listed again in §8.3 under the scripting task that will exercise them. The Queue column is the §8.2 task number.

| §    | Row                                                           | Status          | Needed by                                                                   | Queue  |
| ---- | ------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- | ------ |
| 3.1  | A player side scheme in play                                  | partial         | every player side scheme (13 cards, five packs); campaign 40190a–40195a     | 1      |
| 3.2  | The player side scheme limit                                  | missing         | the same; Technovirus Resurgence 40031                                      | 3      |
| 3.3  | Assault                                                       | partial         | Morlock Siege 40087; Mutant Insurrection; X-23 43018, 43020                 | 4      |
| 3.4  | A per player printed cost                                     | missing         | Team Investigation 40053; Break Time 44046; Extreme Measures; §3.47         | 5      |
| 3.5  | Alliance                                                      | exists          | 40053, 44046                                                                |        |
| 3.6  | A villain deck of different titles, one in play               | exists (verify) | Morlock Siege                                                               |        |
| 3.7  | A defeated villain placed under a card, and counted there     | partial         | Morlock Siege (Routed 40081)                                                | 6      |
| 3.8  | "Shares a title with" as a query                              | partial         | Morlock Siege; Mutant Slayers 40102; On the Run 1A                          | 7      |
| 3.9  | An enemy attack redirected to an ally its target controls     | exists (verify) | Morlock Siege (Morlock 40079)                                               |        |
| 3.10 | "Card abilities cannot remove this ally from play"            | partial         | Morlock Siege (Morlock allies)                                              | 8      |
| 3.11 | An encounter card's "choose" between two effects on an attack | compose         | the Marauders villains; Mutant Slayers                                      |        |
| 3.12 | What advanced the main scheme                                 | partial         | Morlock Siege (Mutant Massacre 2A); Stryfe (§3.34)                          | 9      |
| 3.13 | Setup: one random villain, the rest removed from the game     | partial         | On the Run 1A                                                               | 12     |
| 3.14 | An enemy activation replaced; a defeat replaced               | exists (verify) | On the Run (Hope's Captor 40105); see §8.6                                  | 13     |
| 3.15 | A non-final main scheme stage whose completion loses          | exists          | On the Run 1B; Stryfe 1B                                                    |        |
| 3.16 | Superlative and fallback attach hosts for enemies             | exists (verify) | Military Grade; On the Run                                                  |        |
| 3.17 | Damage placed on an attachment instead; who dealt it          | exists (verify) | On the Run (Hidden in the Clutter 40106)                                    |        |
| 3.18 | "After your hero defends … and takes no damage"               | exists (verify) | On the Run (Favored Weapon 40107)                                           |        |
| 3.19 | An identity's text box blanked; an enemy attack as a cost     | partial         | Military Grade 40092; Morlock Siege 40083; Domino 40065; Deadpool's nemesis | 10, 11 |
| 3.20 | A boost card that shuffles itself into the encounter deck     | exists (verify) | Nasty Boys (Hairbag 40113)                                                  |        |
| 3.21 | Reusable as is, pass 1a                                       | compose         | Morlock Siege, On the Run and their modular sets                            |        |
| 3.22 | Counters on a villain that carry between stages               | exists (verify) | Juggernaut                                                                  |        |
| 3.23 | A completion replaced by numbered steps                       | exists (verify) | Juggernaut (main scheme 40121)                                              |        |
| 3.24 | A permanent attachment other cards flip back and forth        | exists (verify) | Juggernaut (the Helmet)                                                     |        |
| 3.25 | An ally the first player controls, that must stay in play     | partial         | Hope Summers 40130, 40131; Juggernaut, Mister Sinister, Stryfe              | 14, 15 |
| 3.26 | A character limited to one attack target and one scheme       | exists (verify) | Stryfe (Stryfe's Grasp 40168a)                                              |        |
| 3.27 | "After a status card is placed on X"                          | missing         | Mister Sinister I–III; Super Strength                                       | 16     |
| 3.28 | Alternative main scheme stages, one removed at random         | partial         | Mister Sinister (40139–40142)                                               | 17     |
| 3.29 | A named set-aside set: one attached, the rest shuffled in     | exists (verify) | Mister Sinister stage 2Bs; Crisis of Infinite Deadpools 44037               |        |
| 3.30 | Damage rules that read the attacker or the attack's keywords  | partial         | Flight 40152, 40153; Extreme Measures 40182                                 | 18     |
| 3.31 | A player's damage sent elsewhere unless they pay              | exists (verify) | Mister Sinister (Sinister Disguise 40144)                                   |        |
| 3.32 | The most common card type in a hand                           | missing         | Stryfe I–III, 40166b, 40174, 40176, 40177, 40179                            | 19     |
| 3.33 | "Choose a card type"                                          | partial         | Stryfe (Psychic Override 40178)                                             | 20     |
| 3.34 | A permanent side scheme that flips                            | partial         | Stryfe (Stryfe's Grasp / Living Bomb 40168a/b)                              | 13, 21 |
| 3.35 | An attach host decided by a condition at reveal               | partial         | Stryfe (Mental Transferal 40169)                                            | 22     |
| 3.36 | Enter play exhausted; "attacked and thwarted this phase"      | partial         | Stryfe (Mind Trap 40171, Psychic Inertia 40173)                             | 23, 24 |
| 3.37 | A villain stage's When Revealed during setup                  | exists (verify) | expert Juggernaut, Mister Sinister, Stryfe                                  |        |
| 3.38 | Named encounter cards dealt facedown                          | exists (verify) | Stryfe (Psionic Surge 40177); campaign scenario 3                           |        |
| 3.39 | Reusable as is, pass 1b                                       | compose         | scenarios 3–5 and their modular sets                                        |        |
| 3.40 | A campaign choice a retry must repeat                         | partial         | the campaign                                                                | 32     |
| 3.41 | Damage on a card, read out of the finished game               | missing (small) | the campaign (Hope Summers's damage)                                        | 33     |
| 3.42 | The starting villain put into play by the main scheme's Setup | partial         | On the Run, standalone and campaign                                         | 12     |
| 3.43 | A campaign player side scheme, flipping to an environment     | partial         | Cable's Setup and obligation (item 1); campaign 40190a–40195a (the rest)    | 2, 31  |
| 3.44 | A minion attached to an ally it treats as a minion            | partial         | campaign Malice 40199; `dreadpool` 'Pool-ized 44041                         | 35     |
| 3.45 | Cards the campaign log carries into each game                 | exists (verify) | the campaign definition                                                     |        |
| 3.46 | The expert campaign                                           | compose         | the campaign definition                                                     |        |
| 3.47 | "A printed cost of N or more" as a query                      | missing (small) | campaign (Practiced Maneuvers 40194b)                                       | 34     |
| 3.48 | Reusable as is, pass 1c                                       | compose         | the campaign cards                                                          |        |
| 3.49 | The victory display as a source and a destination             | missing         | Cable 40010, 40013, 40031                                                   | 25     |
| 3.50 | A constant ability that works from the victory display        | missing         | Cable (Technovirus Purge 40006)                                             | 26     |
| 3.51 | "Characters other than X cannot remove threat from here"      | partial         | Cable (Technovirus Purge 40006)                                             | 27     |
| 3.52 | "After [identity] defeats a side scheme"                      | exists (verify) | Cable 40001a                                                                |        |
| 3.53 | An obligation that puts a player side scheme into play        | partial         | Cable (Technovirus Resurgence 40031); a script once 2, 3 and 25 land        | script |
| 3.54 | "When the main scheme would be completed" on a player card    | exists (verify) | Cable (Temporal Leap 40013)                                                 |        |
| 3.55 | A player-deck discard the discarded card can answer           | missing         | Domino 40043, 40045; basics 40057, 40060; X-23's Rictor                     | 28     |
| 3.56 | Resource icons on cards discarded from a deck                 | partial         | Domino 40037a and ten of her cards                                          | 29     |
| 3.57 | Swapping a hand card with the top of the deck or discard pile | exists (verify) | Domino 40037a/b                                                             |        |
| 3.58 | Facedown cards attached to a support, to a maximum            | exists (verify) | Domino (The Painted Lady 40045); Deadpool 44009                             |        |
| 3.59 | "When you make a ranged attack"                               | missing         | Sharpshooter 40064                                                          | 30     |
| 3.60 | An enemy that cancels events; bans scoped to one player       | exists (verify) | Cable's nemesis set (40032–40036); Deadpool 44032                           |        |
| 3.61 | Reusable as is, pass 2a                                       | compose         | Cable, Domino, the box's aspect and basic cards                             |        |
| 3.62 | A three-face identity whose hero faces differ only by title   | partial         | Angel 42001a/b/c, 42005, 42024                                              | 38     |
| 3.63 | A scheme icon on an identity face or an obligation in play    | partial         | Angel (Archangel 42001c, 42024)                                             | 39     |
| 3.64 | A double-sided permanent upgrade its controller flips         | partial         | Psylocke 41001, 41002a/b, 41025                                             | 36     |
| 3.65 | "The number of [type] resources on cards you control"         | exists (verify) | Psylocke's nemesis set (41026, 41029)                                       |        |
| 3.66 | A player's attack redirected to a friendly character          | missing         | Psylocke's nemesis set (Psionic Illusion 41028)                             | 37     |
| 3.67 | An attack whose boost icons and Boost abilities are ignored   | missing         | Angel (Aerial Agility 42004)                                                | 40     |
| 3.68 | A played event returned to hand after it resolves             | partial         | Angel (Avian Anatomy 42008)                                                 | 41     |
| 3.69 | "An attack that has a keyword"; "Max 1 per attack"            | missing         | Psylocke's pack (Directed Force 41019)                                      | 30     |
| 3.70 | An obligation that stays in play until its Action discards it | exists (verify) | 41025, 42024, 40065, 44032                                                  |        |
| 3.71 | An either-trait identity play restriction                     | compose         | Angel's pack (Elixir 42011)                                                 |        |
| 3.72 | Reusable as is, pass 2b                                       | compose         | Psylocke, Angel                                                             |        |
| 3.73 | 'Pool as a deck's chosen aspect                               | exists          | Deadpool; the 'Pool aspect                                                  |        |
| 3.74 | An encounter set included only when a player chose an aspect  | missing         | `dreadpool` 44037–44042                                                     | 43     |
| 3.75 | Linked cards set aside at setup                               | partial         | X-23 (43021, 43034–43037)                                                   | 42     |
| 3.76 | Acceleration tokens on the main scheme as a number            | partial         | Deadpool 44002, 44003, 44007, 44011                                         | 44     |
| 3.77 | The four encounter icons counted across every card in play    | partial         | 'Pool 44017, 44019, 44021, 44023, 44052, 44055                              | 46     |
| 3.78 | A player's defeat replaced                                    | exists (verify) | Deadpool 44001a; Git Gud 44028                                              |        |
| 3.79 | A damage cost whose amount the payer chooses                  | missing         | Deadpool 44004, 44006                                                       | 47     |
| 3.80 | A resource card whose yield is computed                       | partial         | Deadpool 44007; 'Pool 44025–44027                                           | 45     |
| 3.81 | "Search your collection"                                      | missing         | Deadpool (Armed to the Teeth 44009)                                         | 49     |
| 3.82 | "Counts as 2 restricted cards"                                | missing         | 'Pool (Laser Swords 44055)                                                  | 48     |
| 3.83 | Facts from outside the game                                   | missing         | 44028, 44046, 44032                                                         | 50     |
| 3.84 | Marked spaces on a card                                       | compose         | 'Pool (Blackout 44053, Tic-Tac-Toe 44057)                                   |        |
| 3.85 | "After X takes any amount of damage" when it defeated X       | exists (verify) | X-23 43001a; Honey Badger 43003                                             |        |
| 3.86 | An obligation that holds a card facedown under it             | exists (verify) | X-23 (Self-Isolation 43028)                                                 |        |
| 3.87 | Reusable as is, pass 2c                                       | compose         | X-23, Deadpool, the 'Pool aspect                                            |        |

Counts: 48 rows are missing or partial (18 missing, two of them small; 30 partial, of which §3.53 only waits on
other rows), 26 are exists (verify), 3 exist and 10 compose (four "exists (compose)" rows and the six "Reusable as
is" tables).

### 8.2 Engine queue, in order

50 tasks from 48 rows: the 47 missing or partial rows with work of their own, and §3.14 (§8.6). Five rows are split
because they bundle mechanisms (§3.19, §3.25, §3.34, §3.36, §3.43); two pairs of rows are merged because they share
one (§3.13 with §3.42; §3.59 with §3.69), §3.14's missing half is one task with §3.34's item 2, and §3.44's two cards
(Malice, 'Pool-ized) are one task. "After N" names a dependency, not just the order. File paths are under
`packages/engine/src/` unless they start with `content/` (`packages/content/src/schema/`) or `dsl/`
(`packages/cards/src/dsl/`). Every task adds its own colocated test file. **Questions:** "A" means the task builds on
the recommended default and the other answer is a small change afterward; **blocked** means the task waits for the
owner's answer.

**The cross-cutting rules**

| #   | §             | Deliverable                                                                                                                                                                                                              | Files                                                                                         | Unblocks                                                                                      | Questions                        |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | 3.1           | A player side scheme shows its printed scheme icons (`showingIconsOn`); `player-side-scheme.test.ts` pins gaps 2–5 (undefeated discard, "the player who defeated", encounter text counting them, elimination sweep)      | `rules.ts`, `resolve/event.ts`, `resolve/defeat.ts` (elimination), new test                   | 40006, 40018–40020, 40027, 40054, 40059, 41016, 42017, 43018, 43021, 43039, 44024             | Q2: A                            |
| 2   | 3.43 item 1   | A player side scheme can enter play by an effect: placement, controller, starting threat and uniqueness move from `executePlayCardFrame` into the shared enter-play path, which the play frame then calls                | `resolve/play-card.ts`, `resolve/enter-play.ts`                                               | Nathan Summers's Setup (40001b), Professor 40008, 40031, Temporal Leap 40013, tasks 3, 25, 31 | none                             |
| 3   | 3.2 (after 2) | `playerSideSchemeLimit`, `checkPlayerSideSchemeLimit` in `enterPlay` with a choice frame, `RuleSpec excludedFromPlayerSideSchemeLimit`, log `playerSideSchemeLimitDiscard`                                               | `resolve/enter-play.ts`, `abilities.ts`, `rules.ts`, `events.ts`, `dsl/abilities.ts`          | every player side scheme; MC40 p. 21's Technovirus Resurgence fixture                         | Q1: A                            |
| 4   | 3.3           | `assault.test.ts` for gap 2 (ally consequential damage, next-basic-power bonuses, confused thwarter); a divided basic thwart that includes an assault scheme uses ATK                                                    | `actions.ts`, `select.ts`                                                                     | Territorial Control 40087, Mutant Insurrection's scheme, 43018, 43020                         | Q3: A (changes shipped behavior) |
| 5   | 3.4, §1.3     | `CostedCard.costPerPlayer` and one reader, `printedCostOf(state, card)`; every reader of `card.cost` goes through it (pricing, reducer floors, `ValueSpec printedCost` / `totalPrintedCost`, cost queries, superlatives) | `content/cards/player-cards.ts`, `actions.ts`, `select.ts`, `query.ts`, `spec.ts`, `rules.ts` | 40053, 44046, Extreme Measures' scheme, Greycrow, task 34                                     | none                             |

**Morlock Siege**

| #   | §        | Deliverable                                                                                                                                                             | Files                                                                                      | Unblocks                                                             | Questions |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | --------- |
| 6   | 3.7      | A villain's defeated last stage can be tucked under a card from a response to `characterDefeated` (`tuckCards` accepting it), ending faceup in the host's `tucked` list | `resolve/defeat.ts`, `resolve/apply-effect.ts`, `spec.ts`                                  | Routed 40081a/b and the ten cards that count under it                | none      |
| 7   | 3.8      | `TargetQuery sharesTitleWith: TargetRef`, usable under `not`; titles only                                                                                               | `spec.ts`, `query.ts` / `select.ts`, `dsl/values.ts`                                       | Routed, Bound by Business 40102, task 12                             | none      |
| 8   | 3.10     | `cannotLeavePlay.by?: "cardAbilities"`: moves and "defeat" effects from a card ability do nothing; 0 hit points still defeats; elimination still removes                | `abilities.ts`, `rules.ts`, `resolve/event.ts`                                             | Morlock 40079 and the Morlock allies                                 | Q7: A     |
| 9   | 3.12     | `MainSchemeState.advancedBy { cause, sourceInstanceId }`, copied onto `mainSchemeAdvanced` and the log; `Predicate mainSchemeAdvancedBy`                                | `state.ts`, `trigger-events.ts`, `resolve/defeat.ts`, `resolve/apply-effect.ts`, `spec.ts` | Mutant Massacre 2A (40078); Stryfe's stage 2 by card text            | none      |
| 10  | 3.19 (a) | `blankTextBox` on an identity from an attachment or obligation: both faces, keywords included, traits kept; `blank-text-box.test.ts` extended                           | `rules.ts`, `abilities.ts`, `keywords.ts`                                                  | Inhibitor Collar 40092, Memories of Armageddon 40065, Tabula Rasa 16 | Q12: A    |
| 11  | 3.19 (b) | `AbilityCost enemyAttack { enemy, against: "you" }`: the attack resolves in full as the cost; an attack that cannot be made leaves the cost unpaid                      | `abilities.ts`, `payable.ts`, `actions.ts` (cost settlement), `legal.ts`                   | Pushed to the Limit 40083                                            | Q13: A    |

**On the Run**

| #   | §                          | Deliverable                                                                                                                                                                                                      | Files                                                                                | Unblocks                                             | Questions      |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------- |
| 12  | 1.21, 3.42, 3.13 (after 7) | `Scenario.startingVillain: "bySetup"`: `createGame` accepts a single-villain game with every villain set aside; a 200-seed test of 1A's Setup (random villain, the rest and the title-sharing minion removed)    | `content/sets.ts`, `setup.ts`, `setup-steps.ts`, `set-aside-villains.test.ts`        | Gotta Get Away 1A (40103); the campaign's scenario 2 | none           |
| 13  | 3.14, 3.34 item 2 (§8.6)   | A double-sided encounter card that is not a villain goes through the reveal of its new face when card text says "flip … and reveal" (When Revealed, and a side scheme's starting threat on top of what it holds) | `resolve/apply-effect.ts` (`flipCard`), `resolve/other-face.ts`, `resolve/reveal.ts` | Hope's Captor 40105b; Living Bomb 40168b; task 21    | Q10: A; Q19: A |

**Juggernaut (and the Hope Summers set, which scenarios 3–5 all require)**

| #   | §                         | Deliverable                                                                                                                                                                         | Files                                                                           | Unblocks                                        | Questions      |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| 14  | 3.25 items 1–2            | A setup-keyword ally in the encounter deck enters play under the first player's control (no ally limit discard); `controlledByFirstPlayer` verified on an ally, through elimination | `setup-steps.ts` (`putSetupCardsIntoPlay`), `resolve/enter-play.ts`, `rules.ts` | Hope Summers 40130 in every 1A Setup of §2.5    | none           |
| 15  | 3.25 items 3–5 (after 14) | Base THW and ATK set from the controller's hero; "leaves play, the players lose" with `LossReason requiredCardLeftPlay`; the Sinister Ends redirect test                            | `state.ts` (LossReason), `resolve/event.ts`, `query.ts` (stats), `events.ts`    | 40130, Captive Hope 40131, Sinister Ends 40143b | Q14: A; Q16: A |

**Mister Sinister**

| #   | §    | Deliverable                                                                                                                                                     | Files                                                                                         | Unblocks                                                       | Questions |
| --- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| 16  | 3.27 | `TriggerEvent statusPlaced`, announced by every path that lands a status card (effects, toughness, `keepsGivingStatus`); `on.statusPlaced(target, { status? })` | `trigger-events.ts`, `resolve/apply-effect.ts`, `keywords.ts`, `rules.ts`, `dsl/abilities.ts` | Mister Sinister I–III (40136–40138); Super Strength            | none      |
| 17  | 3.28 | `EffectSpec removeMainSchemeStages { stageNumber, random }`; `shuffleMainSchemeStages.stageNumber`; the expert setup-order test                                 | `spec.ts`, `resolve/apply-effect.ts`, `resolve/defeat.ts`, `dsl/effects.ts`                   | Sinister Intent 1B (40139b), 40140–40142                       | none      |
| 18  | 3.30 | `cannotTakeDamage.exceptAttacker` / `exceptAttackKeyword`; `reduceDamageTaken.exceptAttacker`; `characterIgnores` gains `"retaliate"` with `against`            | `abilities.ts`, `rules.ts`, `resolve/event.ts` (damage), `keywords.ts`                        | Out of Reach 40153, Aerial Bombardment 40152, Thumbelina 40182 | Q17: A    |

**Stryfe**

| #   | §                                | Deliverable                                                                                                                                                                | Files                                                                             | Unblocks                                         | Questions |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ | --------- |
| 19  | 3.32                             | `ValueSpec largestHandTypeGroup { player }`                                                                                                                                | `spec.ts`, `select.ts`, `dsl/values.ts`                                           | Stryfe I–III, 40166b, 40174, 40176, 40177, 40179 | Q18: A    |
| 20  | 3.33                             | `EffectSpec chooseCardType { player, bind }` over the fifteen card types; query clause `cardTypeIs: { chosen }`; log `cardTypeChosen`                                      | `spec.ts`, `resolve/apply-effect.ts`, `choices.ts`, `select.ts`, `dsl/effects.ts` | Psychic Override 40178                           | none      |
| 21  | 3.34 items 1, 3, 4 (after 9, 13) | A permanent side scheme answers "the last threat is removed" and a named villain stage's defeat; `cannotBeDefeated` ends with Living Bomb and the state check then defeats | `resolve/defeat.ts`, `resolve/event.ts`, `trigger-events.ts`                      | Stryfe's Grasp / Living Bomb 40168a/b            | Q21: A    |
| 22  | 3.35                             | `AbilityDefinition.attachInstruction`: resolved at the reveal's attach step, not stopped by `cancelWhenRevealed`                                                           | `abilities.ts`, `resolve/reveal.ts`, `dsl/abilities.ts`                           | Mental Transferal 40169                          | none      |
| 23  | 3.36 gap 1                       | `RuleSpec entersPlayExhausted { target, while? }`, read where `entersExhausted` is and by `putIntoPlay`                                                                    | `abilities.ts`, `rules.ts`, `resolve/play-card.ts`, `resolve/enter-play.ts`       | Mind Trap 40171                                  | none      |
| 24  | 3.36 gap 2                       | A per-phase record of attacks and thwarts by character; `Predicate characterDidThisPhase { character, did }`                                                               | `state.ts`, `spec.ts`, where `attacksThisTurn` is written, `dsl/values.ts`        | Psychic Inertia 40173                            | Q23: A    |

**Cable**

| #   | §                 | Deliverable                                                                                                                                                                     | Files                                                                                       | Unblocks                                                 | Questions |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------- |
| 25  | 3.49 (after 2, 3) | `CardSelector victoryDisplay`, `CardDestination "victoryDisplay"`, `putIntoPlay` from the victory display (an encounter side scheme enters unrevealed with its starting threat) | `spec.ts`, `select.ts`, `resolve/apply-effect.ts`, `resolve/enter-play.ts`, `dsl/values.ts` | Forced Amnesia 40010, Temporal Leap 40013, 40031 (§3.53) | Q30: A    |
| 26  | 3.50              | `AbilityDefinition.activeIn` gains `"victoryDisplay"`: a constant collected only while its card is there                                                                        | `abilities.ts`, `rules.ts`, `resolve/triggers.ts`, `legal.ts`                               | Technovirus Purge 40006                                  | none      |
| 27  | 3.51              | `threatCannotBeRemoved.exceptBy?: TargetQuery` on the removing card; `legalActions` and `why-not.ts` honor it                                                                   | `abilities.ts`, `rules.ts`, `legal.ts`, `why-not.ts`                                        | Technovirus Purge 40006                                  | Q29: A    |

**Domino and the box's basic cards**

| #   | §               | Deliverable                                                                                                                                                                                  | Files                                                                                                                                        | Unblocks                                                                    | Questions              |
| --- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------- |
| 28  | 3.55 (after 26) | `TriggerEvent cardDiscardedFromDeck` from all three discarding paths, gated on a listener; `activeIn: "discard"`; `on.thisDiscardedFromYourDeck()`, `on.youDiscardFromYourDeck()`; log event | `trigger-events.ts`, `abilities.ts`, `resolve/apply-effect.ts`, `resolve/triggers.ts`, `actions.ts` (deck-discard costs), `dsl/abilities.ts` | Jackpot! 40043, The Painted Lady 40045, White Fox 40057, Digging Deep 40060 | Q31: A; Q32: A; Q33: A |
| 29  | 3.56 (after 28) | `RuleSpec deckDiscardIconCount { player, resource, times }`, applied by the `<bind>.<type>` totals and by `totalPrintedResources` over a deck-discard slot                                   | `abilities.ts`, `rules.ts`, `resolve/apply-effect.ts`, `query.ts`                                                                            | Domino 40037a and the ten cards that count icons                            | Q31: A                 |
| 30  | 3.59, 3.69      | One filter, `on.attacks(you, { has: AttackKeyword[] })`, over `attackKeywordsOf`; a play limit scoped to the attack frame ("Max 1 per attack")                                               | `trigger-events.ts`, `spec.ts` (EventPattern), `keywords.ts`, `actions.ts`, `dsl/abilities.ts`                                               | Sharpshooter 40064; Directed Force 41019                                    | none                   |

**The campaign**

| #   | §                        | Deliverable                                                                                                                                                                                                            | Files                                                                                                   | Unblocks                          | Questions      |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------- |
| 31  | 3.43 items 2–5 (after 3) | A player side scheme with no controller (survives elimination, removed from the game if discarded); the exemption constant; the When Defeated flip to an environment; `campaign-player-side-scheme.test.ts`            | `resolve/enter-play.ts`, `resolve/event.ts`, `resolve/other-face.ts`, `resolve/defeat.ts` (elimination) | 40190a/b–40195a/b                 | Q24: A         |
| 32  | 3.40                     | `CampaignOp choose.repeatOnRetry`: a retry of a lost node reuses the recorded pick, traced with `repeated: true`                                                                                                       | `campaign.ts`, `campaign/ops.ts`, `campaign/runner.ts`                                                  | `campaigns/next_evol.ts`          | none           |
| 33  | 3.41                     | `CampaignGameQuery damageOn { query }`                                                                                                                                                                                 | `campaign.ts`, `campaign/result.ts`                                                                     | scenarios 3 and 4's Victory steps | none           |
| 34  | 3.47 (after 5)           | `TargetQuery.minPrintedCost`, read through `printedCostOf`                                                                                                                                                             | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                 | Practiced Maneuvers 40194b        | none           |
| 35  | 3.44                     | A minion its own When Defeated attached stays in play as a minion, is never defeated again and never activates, and leaves with its host; `treat-as-minion.test.ts` gains the five FAQ bullets and one 'Pool-ized test | `resolve/defeat.ts`, `resolve/enemy-activation.ts`, `treat-as.ts`, `resolve/apply-effect.ts`            | Malice 40199; 'Pool-ized 44041    | Q26: A; Q27: A |

**Psylocke**

| #   | §    | Deliverable                                                                                                                                                 | Files                                                                          | Unblocks                                       | Questions |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | --------- |
| 36  | 3.64 | `RuleSpec cannotFlip { target, while? }`, read by `flipCard` and by optional flips; the restricted limit checked after a flip, never discarding a permanent | `abilities.ts`, `rules.ts`, `resolve/apply-effect.ts`, `resolve/enter-play.ts` | Psi-Knife / Psi-Katana 41002a/b, 41001a, 41025 | Q38: A    |
| 37  | 3.66 | `retargetAttack` widened to the innermost player `attack` event (same attacker, damage, keywords and source)                                                | `spec.ts`, `resolve/apply-effect.ts`, `stack.ts`                               | Psionic Illusion 41028                         | Q40: A    |

**Angel**

| #   | §                  | Deliverable                                                                                                                                                                                                    | Files                                                                    | Unblocks                                     | Questions |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | --------- |
| 38  | 3.62               | `changeForm.heroForm: { named }`; a bare "change form" from a hero face of a three-face identity asks among the other faces; `faceNamed` builder moved to `dsl/values.ts`; `wave2/ant` and `wave2/wsp` audited | `spec.ts`, `resolve/effects-frame.ts`, `dsl/values.ts`, `dsl/effects.ts` | Angel 42001a/b/c, Metamorphosis 42005, 42024 | Q42: A    |
| 39  | 3.63 (after 1, 38) | `HeroFace.schemeIcons`, read in `showingIconsOn` through the identity's showing face                                                                                                                           | `content/cards/identity.ts`, `rules.ts`                                  | Archangel 42001c                             | none      |
| 40  | 3.67               | A rule lasting until the end of an attack under which each boost card is turned up and discarded, adds 0 and resolves no Boost ability, without canceling it                                                   | `abilities.ts`, `rules.ts`, `resolve/enemy-activation.ts`                | Aerial Agility 42004                         | Q41: A    |
| 41  | 3.68               | A destination on the play frame (`afterResolving: "hand"`), set by an effect naming `paidFor`                                                                                                                  | `stack.ts`, `resolve/play-card.ts`, `spec.ts`, `dsl/effects.ts`          | Avian Anatomy 42008                          | none      |

**X-23**

| #   | §                    | Deliverable                                                                                                                                                       | Files                                                        | Unblocks                                            | Questions |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- | --------- |
| 42  | 3.75 (after 1, 2, 3) | Setup sets aside each linked card named by a title in a deck (a scan of the pool for `linked`), ownerless until a player takes control; log `linkedCardsSetAside` | `setup.ts`, `state.ts`, `resolve/enter-play.ts`, `events.ts` | Specialized Training 43021, Specialists 43034–43037 | none      |

**Deadpool and the 'Pool aspect**

| #   | §               | Deliverable                                                                                                                                                                                                                  | Files                                                                                                         | Unblocks                                                       | Questions                  |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| 43  | 3.74            | `EncounterSet.autoIncluded`; the encounter deck build adds `shuffledIn` and sets the rest aside when a seat declared the aspect; `PlayerSetup.aspects` always read; `validateScenario` refuses a scenario listing such a set | `content/sets.ts`, `content/validation.ts`, `setup.ts`, `campaign/runner.ts`, `events.ts`                     | `dreadpool` 44037–44042                                        | Q44: A                     |
| 44  | 3.76            | `ValueSpec accelerationTokens { on }`, DSL `accelerationTokensOn`                                                                                                                                                            | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                       | Cable 44002, 44003, 44011                                      | none                       |
| 45  | 3.80 (after 44) | `ResourceMultiplierSpec.factor: number or ValueSpec`; `additional { resource, amount }`, added before any multiplier                                                                                                         | `abilities.ts`, `actions.ts` (`multiplyPool`), `dsl/abilities.ts`                                             | Montage 44007; 44025–44027                                     | none                       |
| 46  | 3.77 (after 1)  | `ValueSpec iconsInPlay { icons? }` over the existing `iconsInPlay`, DSL `encounterIconsInPlay()`                                                                                                                             | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                       | 44017, 44019, 44021, 44023, 44052, 44055                       | none                       |
| 47  | 3.79            | `AbilityCost.damageSelf: { choose: { min, max } }`, opening the existing `chooseNumber` choice and recording `cost.damageSelf`                                                                                               | `abilities.ts`, `cost-damage.ts`, `legal.ts`                                                                  | Maximum Effort 44004, "Yoo-Hoo!" 44006                         | Q46: A                     |
| 48  | 3.82 (after 36) | `PlayerCard.restrictedWeight`; one reader, `restrictedLoadOf`, at the three sites the limit is checked                                                                                                                       | `content/cards/player-cards.ts`, `select.ts`, `resolve/enter-play.ts`, `actions.ts`                           | Laser Swords 44055                                             | Q52: A                     |
| 49  | 3.81            | `EffectSpec searchCollection { filter, bind }`: a choice over card definitions in the pool that creates a new instance; log `cardAddedFromCollection`                                                                        | `spec.ts`, `resolve/apply-effect.ts`, `choices.ts`, `state.ts`, `dsl/effects.ts`                              | Armed to the Teeth 44009                                       | **Q47: blocked**           |
| 50  | 3.83            | `PlayerSetup.outsideFacts` with `Predicate outsideFact`; `EffectSpec reportFact { fact, bind }` and its choice kind                                                                                                          | `setup.ts`, `state.ts`, `spec.ts`, `resolve/apply-effect.ts`, `choices.ts`, `dsl/effects.ts`, `dsl/values.ts` | Git Gud 44028, Break Time 44046, The Merc with the Mouth 44032 | **Q48, Q49, Q50: blocked** |

**Notes on the order.**

- Task 2 is §3.43's first item pulled forward: Cable's own Setup puts a player side scheme into play without playing
  it, and §3.2's check belongs in the shared path, so the path comes before the limit.
- Tasks 26 and 28 both widen `AbilityDefinition.activeIn` and sit two apart; 36 and 48 share the restricted check
  sites; 1, 39 and 46 share `showingIconsOn` / `iconsInPlay`; 9 precedes 21 because Stryfe's stage 2 by card text
  reads `advancedBy`.
- Schema tasks (5, 12, 39, 43, 48) touch `packages/content/src/schema`, which `card-data-pipeline` also edits: the
  main session tells the data agent before each starts, and the data re-emits (40053 and 44046's cost, On the Run's
  scenario record, Archangel's icon, `dreadpool`, 44055) follow each one.
- **Not in the queue:** §3.53 (Technovirus Resurgence) is a script over tasks 2, 3 and 25, and its row's "verify"
  (an obligation attached to a scheme) is the scripting agent's. §3.71's optional data field
  (`PlayRestrictions.requiresIdentityAnyTrait`, asked in §5.4) blocks nothing, since Elixir is scripted with the
  `playOnlyIf` constant; build it only if the client needs the restriction as data.
- Blocked tasks 49 and 50 are last, so nothing waits behind them; Deadpool's identity, events and aspect cards other
  than the four cards they unblock can be scripted without them.

### 8.3 The "exists (verify)" rows, by the scripting task that exercises them

A scripting agent whose card depends on one of these writes the row's "Verify" test first and **reports back at once
if the primitive does not behave as the row says**; the main session then adds an engine task here rather than the
script working around it.

| Scripting task (§8.5)                      | Rows to verify                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Marauders villains + Morlock Siege         | §3.6 (seven villains, the next villain activating against each player), §3.9 (Morlock's redirect; Q5, Q6)                                       |
| On the Run                                 | §3.14 (the replaced activation and the replaced defeat; the reveal on the flip is task 13), §3.16, §3.17 (Q11), §3.18                           |
| Military Grade                             | §3.16 (Heavy Armament's superlative host)                                                                                                       |
| Nasty Boys                                 | §3.20 (Hairbag's boost, on a villain and on a villainous minion)                                                                                |
| Juggernaut                                 | §3.22 (momentum counters across stages), §3.23 (the four numbered steps; Q15), §3.24 (the Helmet's two faces), §3.37 (expert stage II at setup) |
| Mister Sinister                            | §3.29 (one SUPERPOWER card attached, the rest shuffled in; Q20), §3.31 (Sinister Disguise), §3.37                                               |
| Stryfe                                     | §3.26 (Hope Summers's one target and one scheme), §3.37 (Stryfe II at setup), §3.38 (Psionic Surge)                                             |
| The campaign definition                    | §3.45 (every row of its table), §3.38 (scenario 3's shuffled facedown deal)                                                                     |
| Cable: identity                            | §3.52 (`eventSource` on `schemeDefeated`; the limit resets in the villain phase)                                                                |
| Cable: events                              | §3.54 (a player card hears `mainSchemeCompleting`; the four threat cases)                                                                       |
| Cable: obligation + nemesis                | §3.60 (Stryfe 40032's cancel; the Cable-only bans; Q36), §3.53's attach of an obligation to a scheme                                            |
| Domino: identity                           | §3.57 (the swap lands on top; not a draw)                                                                                                       |
| Domino: supports, upgrades, allies         | §3.58 (The Painted Lady's facedown cards)                                                                                                       |
| Domino: obligation + nemesis               | §3.70 (Memories of Armageddon stays in play), with task 10                                                                                      |
| Psylocke: obligation + nemesis             | §3.65 (one resource type over cards in play; the showing face's icons; Q39), §3.70 (Body Swapped; `dealEncounterCardsCost` to another player)   |
| Angel: obligation + nemesis                | §3.70 (Apocalyptic Influence)                                                                                                                   |
| X-23: identity; supports, upgrades, allies | §3.85 (the response when the damage defeated Honey Badger, RRG FAQ p. 64)                                                                       |
| X-23: obligation + nemesis                 | §3.86 (Honey Badger facedown under Self-Isolation)                                                                                              |
| Deadpool: identity; 'Pool aspect (Git Gud) | §3.78 (the replaced defeat; Q45)                                                                                                                |
| Deadpool: obligation + nemesis             | §3.70 and §3.60's player-scoped bans (The Merc with the Mouth)                                                                                  |
| `dreadpool`                                | §3.29 (Crisis's shuffle of the remainder), §3.44's 'Pool-ized test (in task 35)                                                                 |

### 8.4 The questions, by urgency

Nothing is decided yet (§4.1 is empty). Every queue task except 49 and 50 can start on its default; the order below
is the order in which an answer other than A would cost rework.

1. **Before the first engine commit (tasks 1–5):** **Q1** (which scheme the limit may discard: task 3's choice frame),
   **Q3** (assault and a divided thwart: default A changes how already shipped divided thwarts resolve, so it is the
   one early default that alters existing behavior), **Q2** (task 1's "player who defeated").
2. **Before Morlock Siege and On the Run are scripted (tasks 6–13):** **Q7** (damage and "cannot remove this ally"),
   **Q12** and **Q13** (Inhibitor Collar, Pushed to the Limit), **Q10** and **Q19** (what a flip-and-reveal does: task
   13), and the two rulebook-versus-RRG questions **Q4** and **Q5**, whose default (RRG 1.8) is today's behavior and
   needs no code but decides the scenario tests. Q6, Q8, Q9 and Q11 are script-level and can be answered with them.
3. **Before scenarios 3–5 (tasks 14–24):** **Q14** and **Q16** (Hope Summers), **Q17**, **Q18**, **Q21**, **Q23**;
   script-level: Q15, Q20, Q22.
4. **Before Cable and Domino (tasks 25–30):** **Q30** (how a side scheme returns from the victory display), **Q29**,
   **Q31–Q33** (which deck discards count and what they still count for; three answers shape task 28's event);
   script-level: Q34, Q35, Q36.
5. **Before the campaign (tasks 31–35):** **Q24** (who controls a campaign player side scheme: the default, nobody,
   is the larger build), **Q26**, **Q27**; definition-level: Q25, Q28.
6. **Before the hero packs (tasks 36–48):** **Q38** (the restricted check after a flip), **Q40**, **Q41**, **Q42**,
   **Q44**, **Q46**, **Q52**; script-level: Q37, Q39, Q43, Q45, Q51, Q53.
7. **Blocking, but last in the queue:** **Q47** (what "your collection" is and whether copies are counted: task 49)
   and **Q48, Q49, Q50** (the three outside facts: task 50, and with Q49 a client break screen). These four are the
   only answers a task waits for; asking them early costs nothing and lets `game-client-engineer` plan the break
   screen and the collection browser.

### 8.5 Scripting order, after the rows each task needs

One agent per line, wave 6's split (`packages/cards/src/wave7/<pack>/…`, one module per line so parallel agents
never share a file). "Needs" lists §8.2 task numbers; "verify" rows are in §8.3. A line with no number can start
now, beside the engine agent.

**The box: scenarios and modular sets**

1. Marauders villains 40070a/b–40076a/b: needs nothing (§3.11 composes).
2. `morlock_siege` with main schemes 40077, 40078: needs 4, 6, 7, 8, 9, 11.
3. Military Grade: needs 10.
4. Mutant Slayers: needs 7.
5. `on_the_run` with main schemes 40103, 40104: needs 7, 12, 13.
6. Nasty Boys: needs nothing.
7. `hope_summers` (40130, 40131): needs 14, 15.
8. Juggernaut, villain and main scheme 40118–40121, then `juggernaut` 40122–40129: needs 14, 15.
9. Black Tom Cassidy: needs nothing.
10. Mister Sinister, villain and main schemes 40136–40143, then `mister_sinister` 40144–40150: needs 14–17.
11. Flight: needs 18. Super Strength: needs 16. Telepathy: needs nothing. One agent each.
12. Stryfe, villain and main schemes 40163–40167, then `stryfe` 40168–40179: needs 9, 13, 14, 15, 19–24.
13. Extreme Measures: needs 5, 18. Mutant Insurrection: needs 4. One agent each.

**The box: Cable**

14. Registry scaffold + identity 40001a/b (Setup puts a player side scheme into play): needs 1, 2, 3.
15. Events (Temporal Leap, Mind Scan, Askani'son, …): needs 25.
16. Supports, upgrades, allies, with Technovirus Purge 40006 and Forced Amnesia 40010: needs 1, 3, 25, 26, 27.
17. Obligation 40031 + nemesis set 40032–40036: needs 2, 3, 25, 26.
18. Leadership and basic cards of his deck (40014–40030): needs 1, 3 for the player side schemes; the rest nothing.
19. Precon e2e game.

**The box: Domino**

20. Registry scaffold + identity 40037a/b: needs 29.
21. Events: needs 28, 29.
22. Supports, upgrades, allies (The Painted Lady, Jackpot!): needs 28, 29.
23. Obligation 40065 + nemesis set 40066–40069: needs 10.
24. Justice and basic cards of her deck (40050–40064, 40204): needs 5 (Team Investigation), 28 (White Fox, Digging
    Deep), 30 (Sharpshooter), 1 and 3 for the player side schemes.
25. Precon e2e game.

**The box: campaign**

26. Campaign cards 40190–40203: needs 31, 34, 35 (Malice).
27. `campaigns/next_evol.ts` (§2.10, §3.45, §3.46), after all five scenarios: needs 12, 32, 33.
28. A full campaign run with a retry (`rules-qa-engineer`, §5.2).

**Psylocke**

29. Registry scaffold + identity 41001a/b with Psi-Knife / Psi-Katana 41002a/b: needs 36.
30. Events (the four "for each Psi-Knife / Psi-Katana" events): needs 36.
31. Supports, upgrades, allies, with the pack's aspect and basic cards: needs 30 (Directed Force), 1 and 3 (Lay the
    Trap 41016).
32. Obligation 41025 + nemesis set 41026–41029: needs 36, 37.
33. Precon e2e game.

**Angel**

34. Registry scaffold + identity 42001a/b/c: needs 38, 39.
35. Events (Metamorphosis, Aerial Agility, the "if you are Angel / Archangel" events): needs 38, 40.
36. Supports, upgrades, allies, with the aspect and basic cards: needs 41 (Avian Anatomy), 1 and 3 (Render Medical
    Aid 42017).
37. Obligation 42024 + nemesis set 42025–42028: needs 38, 39.
38. Precon e2e game.

**X-23**

39. Registry scaffold + identity 43001a/b with X-23's Claws 43002: needs nothing.
40. Events: needs nothing.
41. Supports, upgrades, allies: needs nothing (Honey Badger is §3.85's verify).
42. Aggression and basic cards: needs 1, 3, 4 (Keep Them Busy, The Direct Approach), 42 (Specialized Training and
    the four Specialists), 28 and 29 (Rictor). The "side scheme in the victory display" play conditions read the
    existing `victoryDisplayCount`.
43. Obligation 43028 + nemesis set 43029–43033: needs nothing.
44. Precon e2e game.

**Deadpool**

45. Registry scaffold + identity 44001a/b: needs nothing (§3.78's verify).
46. Events (Maximum Effort, "Yoo-Hoo!", Montage is a resource): needs 47; 44 for Exhausting Personality.
47. Supports, upgrades, allies and resources (Cable 44002, Montage, It Ain't Over..., Armed to the Teeth): needs 44,
    45, 49.
48. Obligation 44032 + nemesis set 44033–44036: needs 10 (Tabula Rasa 16), 50.
49. The 'Pool aspect, 34 cards, two agents on separate modules (44013–44030; 44043–44058): needs 46, 45 (the three
    Self resources), 48 (Laser Swords), 5 and 50 (Break Time), 50 (Git Gud's discount), 1 and 3 (Live Dangerously).
50. `dreadpool` 44037–44042: needs 43, 35.
51. Precon e2e game, with the Dreadpool sequence test (`encounter-ai-designer`, §5.5).

**Beside the engine agent, now:** lines 1, 6 and 9; X-23's lines 39–41 and 43; Deadpool's line 45; the data fixes of
§7.1–§7.3; the wave's `reprints.ts`. Then, as tasks land: Morlock Siege after 11, On the Run after 13, the Hope
Summers set and Juggernaut after 15, Mister Sinister after 18, Stryfe after 24, Cable after 27, Domino after 30, the
campaign after 35, Psylocke after 37, Angel after 41, X-23's Aggression cards after 42, Deadpool after 48 (four cards
wait on 49 and 50).

### 8.6 Status disagreements found while checking the code

§3's status lines are left as written; the main session decides whether to flip them.

1. **§3.14 is "exists (verify)"; its flip-and-reveal half is not in the code.** The status line says `flipCard`
   gives "the full reveal of the new face (`flipToOtherFace`, wave 6 §4.1 Q36 for villains; attachments reveal as
   encounter cards)". In `resolve/apply-effect.ts` the `flipCard` case pushes `revealNewFaceFrame` only in its
   villain branch; a `flipSide` encounter card just toggles `flipped` and announces `cardFlipped`, and an
   `otherFaceId` card goes through `flipToOtherFace` (`resolve/other-face.ts`), which treats the new face as entering
   play and never resolves a When Revealed. So Hope's Captor b's When Revealed (advance the main scheme) would not
   resolve today. §3.34 item 2 already allows for this ("otherwise it is the same small addition for both cards").
   Suggested status: **partial**; the work is queue task 13. The rest of the row (the replaced activation, the
   replaced defeat) stands as exists (verify).
2. **§3.53 is "partial" with no engine work of its own.** Its plan ends "no new vocabulary beyond §3.49", and its
   own verify (an obligation attached to a scheme) is a script test. Suggested status: **compose, after tasks 2, 3
   and 25**. It is kept out of the queue on that reading.

Checked and agreed: every "missing" row (no trace of the planned identifiers); §3.30 (`characterIgnores.ignores` is
`"guard" | "patrol" | "crisis"` only); §3.36 (only `attacksThisTurn`, no thwart record); §3.62 (`changeForm.heroForm`
is `{ withTrait } | "other"`); §3.63 (`schemeIcons` exists on `BaseCard` and on an encounter flip side, not on
`HeroFace`); §3.76 and §3.77 (no `ValueSpec` reads tokens or icons); §3.80 (`factor: number`); §3.74
(`PlayerSetup.aspects` is optional and defaults to none).
