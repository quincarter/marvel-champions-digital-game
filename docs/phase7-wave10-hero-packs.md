# Phase 7 working spec: wave 10, pass 2 (the Wonder Man and Hercules hero packs)

This is pass 2 of the wave 10 spec, kept in its own file so it can be written and built beside the others. The main
spec is [phase7-wave10.md](phase7-wave10.md) (Civil War in cooperative play); Tigra and Hulkling are in
`phase7-wave10-box-heroes.md`. Sections here carry an `H` prefix (H0 sources, H1 schema and data, H2 the two heroes in
plain words, H3 engine primitives, H4 open questions, H5 notes for the other agents, H7 card coverage, H8 build order)
so a reference never collides with the main spec's numbers. The model is the hero-pack pass of
`docs/phase7-wave9.md` (§0.1, §3.36–§3.52, §7.9–§7.12, §8.4). Wave 1–9 primitives are assumed.

**Scope: every card of the two packs.**

- **Wonder Man** (`wonder_man`, 58001a/b to 58034): the hero kit, the obligation Pacifism 58025, the nemesis set
  58026–58029, and the pack's aspect and basic cards. **No modular set.**
- **Hercules** (`hercules`, 59001a/b to 59045): the hero kit, the Labor deck 59002–59004 and the Gift deck
  59005–59007, the obligation Appeal to Athena 59035, the nemesis set 59036–59040, the All Versus All modular set
  59041–59045, and the pack's aspect and basic cards.

Agents do not edit statuses or open questions; they report, and the main session flips them. If you change a decision
here, update this file in the same change.

**The short version.** Nothing in either pack needs a new card type. The Labor deck's data shape landed in wave 2
(`docs/phase7-wave2.md` §15.3) and the engine refuses to seat Hercules until it can build that deck
(`unbuildableSeparateDeck`, `packages/engine/src/deck.ts`). Of the 22 primitives in H3, **2 are new**, **15 need an
extension** of something that exists, and **5 are reusable** (four of those to be verified or composed in the DSL).
H8.2 queues 17 engine tasks, one primitive each.

---

## H0. Sources read

- **Card text.** `packages/content/raw/marvelcdb/wonder_man.json` (34 records, 35 faces) and `hercules.json` (45
  records, 46 faces), every record and both nested alter-ego faces (`linked_card`) pulled by script. The top level is
  an object (`source`, `fetchedAt`, `pack`, `cards`), not a bare array.
- **Scans read this session** (`assets/card-art/bundles/cards/`), 9 faces: 58009, 58018, 58031, 59001a, 59001b,
  59002, 59003, 59004, 59041. **A printed-card claim in this file is "checked" only for those faces**; every other
  card is "unchecked (raw data)". All nine match the raw text. 58018 prints its cost as "X" (raw `cost: -1`).
- **The two inserts** (one-sheet JPGs linked from Hall of Heroes; fetched and read as images this session):
  - Hercules (`hallofheroeslcg.com/wp-content/uploads/2026/02/hercules-pdf.jpg`). "The Gift and Labor Decks": "he
    begins each game with two special 3-card decks. To create the GIFT and LABOR decks, shuffle the three GIFT cards
    together to form the GIFT deck and the three LABOR cards to form the LABOR deck. Then, place both of these decks
    facedown in your play area. During the game, while in alter-ego form you may use Hercules's 'New Labors of
    Hercules' action to reveal the top card of the LABOR deck. After a LABOR card enters the victory display while in
    hero form, you may use Hercules's 'Atonement' ability to put the top card of the GIFT deck into play." "Alternate
    Player & Encounter Card Backs": "the rules for these cards prevent them from entering a deck, a discard pile, or a
    player's hand." Sidebar "Hercules / Leadership": "the word 'find' allows you to search all in- and out-of-play
    areas except facedown encounter cards, the victory display, and any cards that have been removed from the game
    … the Lernean Hydra is always a potential target for Defeat the Hydra." Featured terms: Assault, Find, Permanent,
    Piercing, Player Side Scheme, Steady, Temporary, Victory X. **The insert gives no setup step number and says
    nothing about a Labor card that finds no target.**
  - Wonder Man (`…/2026/02/wonder-man-pdf.jpg`). Featured terms: Amplify, Permanent, Piercing, Player Side Scheme,
    Setup (keyword), Tuck. "Rules Clarifications": (1) "You can only tuck a card under Ionic Physiology and heal 1
    damage from Wonder Man if there are fewer than 3 tucked cards already." (2) Cameo "allows you to search through
    all of your Marvel Champions cards outside of the current game for an ally that belongs to another identity's set
    of cards." (3) Overpaying with different resource types: "Yes … you can allocate the [physical] resource to pay
    the cost of Ionic Blast and the [energy][energy] resources to overpay." Sidebar: "Wonder Man / Justice".
- **RRG 1.8** (`docs/rules/mc_rulesreference_v18_compressed.md`; pages from the markdown's page footers, by script): "Assault"
  (p. 8), "Attacks Against Allies" (p. 10), "Classifications" (p. 12), "Cost" (pp. 13–14), "Dash (Value)" (p. 15),
  "Deck" (p. 15), "Defend, Defense" (p. 15), "Find" (p. 19), "Hinder X" (p. 22), "Keywords" (p. 25), "Labeled
  Ability" (p. 26), "Leaves Play" (p. 27), "Obligation" (p. 30), "'Otherwise'" (p. 31), "'Overpay'" (p. 31: "See:
  Cost"), "Ownership and Control" (p. 31), "Permanent" (p. 32), "Printed" (p. 35), "Retaliate X" (p. 38), "Reveal"
  (p. 38), "Setup (Keyword)" (p. 40), "Team-Up" (p. 43), "Temporary" (p. 44), "'Then'" (p. 44), "Tuck" (p. 45),
  "Uses (X 'Type')" (p. 46), "Victory X" (p. 46), Appendix I (p. 50), Appendix II steps 11 and 16 (p. 51).
  - **FAQ, p. 65, "Hercules Hero Pack – Labor Cards"** (checked): "Q: What happens if a labor card fails to find a
    target when it is revealed? A: That Labor card is discarded. Any time a Labor card leaves play other than being
    placed in the victory display, place it on the bottom of the Labor deck." No FAQ entry names a Wonder Man card.
  - **Errata, p. 70, "Wonder Man Hero Pack – Ionic Physiology (#2)"** (checked): "Should read: 'Response: After you
    play an event with a printed [energy] resource, tuck that event from your discard pile under this card. Then,
    heal 1 damage from your identity.' (Changed cost arrow to 'Then'.)" No errata for the Hercules pack.
- **FFG rulings** (`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`). Every card title and identity name of the two packs
  was matched against the file by script and each hit read: January 17, 2026 – Ruling 4 (1); January 26, 2026 –
  Ruling 2; February 8, 2026 – Ruling 2; February 20, 2026 – Ruling 3; March 6, 2026 – Rulings 3 and 4; March 19, 2026
  – Ruling 6; June 2, 2026 – Rulings 1 and 2 (3, 4); June 19, 2026 – Ruling 1; July 9, 2026 – Ruling 3 (3). H3 says
  where each lands. Titles shared with older cards (Teamwork, Thor, Hawkeye, Scarlet Witch, Jarvis, Sentry) were
  matched by hand; only June 19 names one of this pass's cards (Teamwork 59021).
- **One ruling and the RRG differ in wording**: a Labor card with no target (March 6, 2026 – Ruling 3 (2): "place it
  on the bottom of the Labor deck"; RRG p. 65: "is discarded", then the bottom of the Labor deck). That is the main
  spec's question 3, restated in H4. No other ruling of this pass disagrees with the RRG.
- **Already gathered.** `docs/phase7-wave10-sources.md` §3, §5, §6.2–§6.3, §7.1–§7.2 and
  `docs/phase7-wave10-data-survey.md` §7 (gaps G6 and G7) were used as pointers; every cite relied on here was
  re-read at its source. Two corrections to the sources page: the Atonement text is "After a labor card is **added
  to** the victory display" (scan 59001a; the insert's prose says "enters"), and the RRG has an "'Overpay'" glossary
  entry (p. 31), which only points at "Cost".
- **Engine and DSL** were searched by name (`packages/engine/src`, `packages/cards/src/dsl`); each H3 status names
  the identifier and file found. Doctor Strange's Invocation deck (`IdentitySeparateDeck`, `PlayerState.separateDecks`,
  `resolve/separate-decks.ts`) and Storm's Weather deck (`noDiscardPileDeckFor`, `query.ts`) were read before
  designing H3.1–H3.3.

---

## H1. Schema and data needs

No new card type. One schema field is new (H1.5); the rest is data the existing schema already expresses.

### H1.1 Hercules's two separate decks

The shape landed in wave 2 (`docs/phase7-wave2.md` §15.3; `IdentitySeparateDeck` in
`packages/content/src/schema/cards/identity.ts`; `EncounterCardCommon.separateDeck`). The curation
(`packages/content/scripts/marvelcdb/curation/hercules.ts`) has no `separateDecks` entry yet and the pack is not
registered for emission. Wanted on 59001a:

```ts
separateDecks: [
  {
    name: "Labor",
    cardFamily: "encounter",
    topCardFaceup: false,
    discardPile: "none",
    whenEmpty: "stayEmpty",
    cards: [59002, 59003, 59004],
  }, // one copy each
  {
    name: "Gift",
    cardFamily: "player",
    topCardFaceup: false,
    discardPile: "none",
    whenEmpty: "stayEmpty",
    cards: [59005, 59006, 59007],
  },
];
```

- **Labor cards 59002–59004 are encounter cards** (typed attachment, attachment, obligation) that print the hero
  set's icon and an alternate encounter back. Each carries `separateDeck: "Labor"`, `encounterSetIds: []`, trait
  Labor, `victory 0`. They are never part of an encounter set, a scenario or a `Deck`.
- **59002 and 59003 print no "Attach to" line.** Their When Revealed attaches them. RRG "Reveal" (p. 38): an
  attachment without attach-to text is placed "on the table in front of the player revealing it. (It is not in
  play.)" The normalizer reports "attachment without an attach rule" for both (survey §8); the record must be legal
  without one.
- **59004 Protect Humanity is typed obligation and is not Hercules's obligation.** His obligation is Appeal to Athena
  59035 alone. Whatever picks an identity's obligation for setup step 4 must never pick a card with `separateDeck`.
- **Gift cards 59005–59007 are player cards** (Permanent upgrades, dash cost, `separateDeck: "Gift"`, `deckLimit: 0`).
  `auxiliaryHeroSetCodes` already folds `hercules_gift_deck` into the hero set.

### H1.2 Counter types

`labor` (Protect Humanity 59004, "Uses (3 labor counters)"), `rebirth` (Firebird 58012), `arrow` (Hawkeye 58013; the
Core Hawkeye's type). Ruling January 26, 2026 – Ruling 2 names Cameo: a counter placed on a card takes that card's
type, which wave 9 §3.6 already builds.

### H1.3 Keywords, icons and restrictions the records must carry

| Card(s)                          | What                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------- |
| 58002, 59005, 59006, 59007       | `permanent`; dash cost (curated)                                             |
| 58031 Cameo                      | `setup` keyword; dash cost (curated); `deckLimit: 1`                         |
| 58018 Everywhere All at Once     | `specialCost: "X"` (scan checked)                                            |
| 59016 Lion of Olympus            | `temporary`                                                                  |
| 59007, 59014                     | `restricted`                                                                 |
| 59026 Ancient Rivalry            | `teamUp` with `names: ["Hercules", "Thor"]`; `deckLimit: 1` (raw quantity 2) |
| 59004                            | `uses` 3 `labor`; `victory` 0                                                |
| 59002, 59003, 59022, 59028       | `victory` 0                                                                  |
| 59043 Kyknos                     | `retaliate` 1, `toughness`, `victory` 0                                      |
| 59045 Roving Mobs                | `victory` 0; crisis icon                                                     |
| 59041 All Versus All             | `hinder` 2 per player; hazard icon; starting threat 2 (fixed)                |
| 59038 Olympic Feud               | hazard icon; starting threat 2 (fixed)                                       |
| 58027 Brother vs. Brother        | amplify icon; starting threat 2 (fixed)                                      |
| 58026 Grim Reaper                | `quickstrike`                                                                |
| 59036 Ares, 59044 Bewitched Off. | `retaliate` 1                                                                |
| 58021 Heroic Conditioning        | `anyPlayerControl`; "Max 1 per player"                                       |
| 58030, 59024                     | attach host (non-Elite minion; ally) with `maxPerHost: 1`                    |
| 58032 Coordinated Effort         | `AttachmentHost { kind: "encounterCard" }`, `maxPerHost: 1` (wave 2 §7.2)    |
| 59039 Ares's Axe                 | "Attach to Ares. Otherwise, attach to the villain."; +2 ATK in its stat box  |

### H1.4 Errata to apply

Ionic Physiology 58002: `text.current` becomes the RRG p. 70 wording ("… under this card. Then, heal 1 damage from
your identity."); `text.printed` keeps the arrow. The emitted `wonder_man` data still has the arrow in both
(`packages/content/src/data/wonder_man/cards.ts`, checked), and the curation's `errata` list is empty.

### H1.5 Wonder Man's deck-building rule (one new field)

Simon Williams 58001b: "Ionic Energy Being — You may include events with a printed [energy] resource icon from any
aspect in your deck." Raw `deck_options: [{ resource: ["energy"], type: ["event"] }]`. The emitted identity has no
`deckbuilding` field. `OffAspectAllowance` (`identity.ts`) narrows by `cardType` and `anyTrait` only, so it cannot
say "by printed resource". Wanted (H3.15):

```ts
deckbuilding: { offAspectAllowance: { cardType: "event", printedResource: "energy" } }
```

### H1.6 Sets, reprints, registration

- **Encounter sets:** `wonder_man_nemesis` (58026–58029; 58029 has two copies), `hercules_nemesis` (59036–59040),
  `all_versus_all` (59041–59045, modular). All Versus All joins the modular pool
  (`packages/cards/src/modular-pool.ts`).
- **Reprints** (raw `duplicate_of_code`): 58017 → 42029 Bombs Away; 58023 → 01088; 59021 → 06032 Teamwork; 59022 →
  40018 Call for Backup; 59027 → 31023 Limitless Stamina; 59029–59031 → 01088–01090; 59032 → 58034 Avengers
  Compound; 59033 → 01092 Helicarrier; 59034 → 08023 Quincarrier.
- **Registration:** `hercules` is not emitted; `wonder_man` is emitted as data only (`DATA_ONLY_*`). Neither curation
  has a starter deck.

---

## H2. The two heroes in plain words

### H2.1 Wonder Man: events are fuel twice

Wonder Man (THW 2, ATK 1, DEF 2, 12 hit points, hand 5; Simon Williams hand 6, REC 3) starts every game with
**Ionic Physiology** in play: a permanent upgrade that holds up to three cards tucked under it.

- **Every energy event he plays is tucked there** from his discard pile once it resolves, and he then heals 1. His
  deck may hold energy events of any aspect, so most of his events qualify.
- **Each tucked card is +1 ATK** ("Power Recycling"). At three cards he attacks for 4.
- **A basic attack spends them**: after Wonder Man makes a basic attack, every tucked card is discarded. Thwarting,
  defending and attack events do not empty it.
- **Overpaying.** Three of his events and several pack cards do more when the player generates more resources than
  the cost (RRG "Cost", p. 13). Mr. Hollywood gives a free energy resource that can only be overpaid, once per card;
  Energy Siphon turns up to 3 damage into extra energy.
- **Setup.** Ionic Physiology is set aside before step 1 (RRG "Permanent", p. 32) and Simon Williams's Setup ability
  puts it into play at step 16. Nothing else is special. Cameo (an aspect card, not his) is a Setup-keyword support.
- **What the player sees.** Ionic Physiology beside the identity with its tucked cards fanned faceup under it, a
  count against 3, and the ATK bonus on the hero. The pay prompt shows how much is being overpaid, by type.

### H2.2 Hercules: labors earn gifts

Hercules (THW 1, ATK 3, DEF 2, 14 hit points, hand 4; his alter-ego is also named Hercules, hand 6, REC 4) brings
**two three-card decks besides his player deck**.

- **The Labor deck** holds three encounter cards with Hercules's set icon: Defeat the Hydra, Embody Pathos (both
  attachments) and Protect Humanity (an obligation with three labor counters). **The Gift deck** holds three
  permanent upgrades.
- **In alter-ego form**, as an action, and only while no Labor card is in play, he reveals the top Labor card. It
  finds its own target: a big non-Elite minion to make tougher, a side scheme to make worse, or Amadeus Cho to
  protect. Only Hercules's own attacks and thwarts can finish the first two.
- **When a Labor card reaches the victory display** (its minion or scheme is defeated, or its last labor counter is
  removed) while he is in hero form, "Atonement" puts the top Gift card into play, readies him and lets him flip to
  alter-ego form, once per phase. Each Gift draws 4 cards as it enters play and gives a permanent bonus, and seven kit
  cards scale with the number of Gift cards he controls.
- **His obligation**, Appeal to Athena, stays in play and makes that count 0 until he pays it off.

**Setup: where the decks sit and who owns them.**

- Both decks are built when the identity is seated (as the Invocation deck is, `setup.ts`), shuffled, and placed
  **facedown in Hercules's play area**. The insert names no step; they exist before step 1 and are untouched by
  drawing, mulligans and the deck-size count.
- **The Hercules player owns all six cards** (RRG "Ownership and Control", p. 31, read with "Deck", p. 15:
  "Certain identities or scenarios may add other decks to the game"). A Labor card in play is an encounter card
  under the scenario's control, as every encounter card is, and it comes home to its owner's Labor deck.
- **No discard pile, no refill.** A Labor card that leaves play goes to the victory display or to the bottom of the
  Labor deck (RRG p. 65). A Gift card is permanent and never leaves play. An empty deck stays empty.
- **What a player sees.** Two small facedown decks beside the identity, labeled Labor and Gift, each with a count.
  Nobody may look at them. The Labor card in play (on its minion, on its scheme, or in Hercules's play area) shows
  whose it is; the victory display lists the finished ones.

---

## H3. Engine primitives (owner: `game-rules-architect`)

Each status is one of **reusable as is**, **needs extension** or **new**. "Verify" means the identifier and its doc
comment were read and the exact use has no test yet; "compose" means the DSL already says it and only a script is
needed. Every name was searched for in `packages/engine/src` and `packages/cards/src/dsl` this session.

| §     | Primitive                                                          | Status                   |
| ----- | ------------------------------------------------------------------ | ------------------------ |
| H3.1  | An identity's separate deck of encounter cards, built at setup     | needs extension          |
| H3.2  | Revealing the top card of a separate deck; "no Labor card in play" | needs extension          |
| H3.3  | A Labor card that leaves play, or cannot enter it                  | needs extension          |
| H3.4  | "Find" with a choice among several cards, in play or out           | needs extension          |
| H3.5  | A reveal that reads each per-player icon on the card as 1          | new                      |
| H3.6  | Threat only one character's thwarts can remove                     | needs extension          |
| H3.7  | A card added to the victory display, as a trigger                  | needs extension          |
| H3.8  | "Would attack" sent to another character; "if Hercules defended"   | reusable as is (verify)  |
| H3.9  | Counting Gift cards; "you are considered to control none"          | reusable as is (compose) |
| H3.10 | The next card of a kind costs 0                                    | needs extension          |
| H3.11 | A cost reduction on the cards a search found, used once per card   | needs extension          |
| H3.12 | A maximum on the cards tucked under a card                         | needs extension          |
| H3.13 | Overpaid resources read by a played card; an X cost overpaid       | reusable as is (verify)  |
| H3.14 | A resource that can only be overpaid                               | needs extension          |
| H3.15 | Deck building: off-aspect cards by printed resource                | needs extension          |
| H3.16 | An additional cost to attack one enemy                             | needs extension          |
| H3.17 | Healing damage from a chosen character as a cost                   | needs extension          |
| H3.18 | A collection search for an ally of an identity not in the game     | needs extension          |
| H3.19 | Any player may help pay the costs on a card                        | new                      |
| H3.20 | A defender declared after the boost cards are turned up            | needs extension          |
| H3.21 | Rulings and errata on behavior the engine already covers           | reusable as is (verify)  |
| H3.22 | Everything else                                                    | reusable as is           |

### H3.1 An identity's separate deck of encounter cards, built at setup

> **Status: needs extension.** `IdentitySeparateDeck` with `cardFamily: "encounter"`, `discardPile: "none"` and
> `whenEmpty: "stayEmpty"` validates (`identity.ts`, `validation.ts`), and `PlayerState.separateDecks`, `ZoneId
> separateDeck`, `CardHome separateDeck` and the setup loop that builds a deck's instances exist (`setup.ts`).
> `unbuildableSeparateDeck` (`deck.ts`) refuses any deck that is not a `"player"` deck, so `createGame` and
> `validateDeck` answer `unsupported_identity` for Hercules.

**Cards.** Hercules 59001b (scan): "Hercules begins the game with a labor deck and a gift deck. (See insert.)"

**Rules.** The insert (H0); RRG "Deck" (p. 15); RRG "Ownership and Control" (p. 31): "A card's owner is the player
whose deck contained the card at the start of setup."

**What is missing.** A Labor instance is an encounter card with an owning player. Today every encounter instance is
owned by nobody and every separate-deck instance is a player card. The readers that branch on "has an owner" to mean
"is a player card" must be found and made to read the card's type instead: `faceVisible` (`visibility.ts`), the
friendly/enemy tests (`attachment-hosts.ts`: "every in-play card with no controller"), the home an encounter card is
discarded to (`query.ts`), `closedToPlayerCard`, and player elimination (RRG "Player Elimination", p. 34).

**Proposed shape.** `unbuildableSeparateDeck` accepts `cardFamily: "encounter"` with `discardPile: "none"` and
`whenEmpty: "stayEmpty"`. Setup builds the instances with `ownerId` the player, `home: { kind: "separateDeck", name }`,
`controllerId: null`, facedown, and shuffles the deck with the seed. In play a Labor card is **controlled by the
scenario and owned by the player**: it is an encounter card for every "encounter card", "attachment" and "obligation"
reader, and never a "card you control".

**Tests (exact numbers).** Hercules seated with a legal 40-card deck: `separateDecks.Labor.deck` has 3, `Gift.deck`
has 3, each `discard` empty, the player deck 40, the hand 6 at step 14. The encounter deck holds 59035 and none of
59002–59004. A Labor card in the deck is not visible to any viewer. `validateDeck` no longer reports
`unsupported_identity`. Doctor Strange and Storm set up exactly as before. Hercules eliminated with Defeat the Hydra
attached: the attachment leaves the game with him and the minion drops from 12 hit points to 6.

### H3.2 Revealing the top card of a separate deck; "no Labor card in play"

> **Status: needs extension.** `revealCard(target, player)` (`dsl/effects.ts`), `CardSelector separateDeck` and
> `topOfDeck`, `exists(...)` / `not(...)` predicates, the action builders. Not found: a reveal whose card comes from an
> identity's separate deck, and an attachment revealed with no attach-to text.

**Cards.** Hercules 59001b (scan): "New Labors of Hercules — Action: If there is no labor card in play, reveal the
top card of the labor deck." The action is on the alter-ego face and prints no limit.

**Rules.** RRG "Reveal" (p. 38): "If a player is instructed by card text to reveal an encounter card from the
encounter deck or any other game area, this same resolution procedure applies." Step 2: an obligation "enters play in
the play area of the player revealing it"; an attachment with no attach-to text is placed "on the table in front of
the player revealing it. (It is not in play.)"; step 3 resolves its When Revealed.

**What to build.** `revealCard` over the top card of `separateDeck("Labor")`: the card leaves the deck faceup, and
the usual reveal steps run with Hercules's player as the revealing player. For 59002 and 59003 the card waits out of
play (the revealed-card slot a treachery uses) while its When Revealed runs; the When Revealed's `attachCard` brings
it into play. The condition is `not(exists(query(trait LABOR, in play)))` on the action; an empty Labor deck makes
the action unusable (nothing to reveal).

**Tests.** Protect Humanity on top: Labor deck 2, the obligation in Hercules's play area with 3 labor counters,
Amadeus Cho in play from the deck, the deck shuffled. A second use that turn: refused (a Labor card is in play). In
hero form: not offered. With the Labor deck empty: not offered. A minion Defeat the Hydra reveals with quickstrike
attacks at once, and one with surge deals its extra card.

### H3.3 A Labor card that leaves play, or cannot enter it

> **Status: needs extension.** `noDiscardPileDeckFor` (`query.ts`) and `moveCard` (`ctx.ts`) already send a card of a
> no-discard-pile separate deck back to its deck, with the log event `returnedToSeparateDeck`, whenever it would enter
> a discard pile, a hand or another deck (Storm's Weather deck, wave 6 §3.46). `defeatFromPlay` (`effects.ts`) sends
> a Victory X attachment to the victory display when its host is defeated and a Victory X uses card there when its
> last counter goes (RRG "Victory X", p. 46; wave 3 §3.4). Not found: the **bottom** as the return position, and the
> case of a revealed card that never entered play. **Main spec question 3 is open; default A is built.**

**Cards.** 59002, 59003, 59004.

**Rules.** RRG FAQ p. 65 (H0). March 6, 2026 – Ruling 3 (2): "If a Labor card cannot enter play, place it on the
bottom of the Labor deck." RRG "Victory X" (p. 46): "An attachment or upgrade with the victory X keyword is placed in
the victory display when the card to which it is attached is defeated"; "A card with both the victory X and uses (X
'type') keywords is placed in the victory display when its last all-purpose counter is removed from it."

**What to build.**

- The return position for an `"encounter"`-family deck is the bottom, facedown. Storm's deck keeps its own.
- A Labor card whose When Revealed finds no target goes to the bottom of the Labor deck (question 3 = A: the log says
  `returnedToSeparateDeck`, and no "discarded" event is raised, so nothing that answers a discard hears it).
- The three ways to the victory display are existing behavior to verify on an owned encounter card: the Hydra's
  minion defeated; Embody Pathos's side scheme defeated; Protect Humanity's last labor counter removed.
- Every other departure goes to the bottom of the Labor deck: the host leaves play without being defeated (a minion
  discarded or shuffled away), or a player card discards the attachment or the obligation.

**Tests.** Defeat the Hydra revealed with no non-Elite minion of 6 printed hit points anywhere: Labor deck back to 3
with it last, log `returnedToSeparateDeck`, no discard event; the action may be used again and reveals the next card.
The Hydra's minion defeated by Hercules: the attachment is in the victory display, the minion in the encounter
discard pile. The same minion discarded by a "discard a minion" effect: the attachment is at the bottom of the Labor
deck and the victory display is unchanged. Protect Humanity at 1 counter, one more removed: victory display, never
the encounter discard pile.

### H3.4 "Find" with a choice among several cards, in play or out

> **Status: needs extension.** `findCard(query, to, { owner, bind })` (`dsl/effects.ts`; wave 6 §3.48) takes "the
> first card `find` names", with no choice. `searchAndReveal`, `chooseCards`, `anyOfCards`, `revealCard`,
> `engage`, and wave 9 §3.63 ("Find [card] and reveal it" for a card in play) exist.

**Cards.** Defeat the Hydra 59002 (scan): "When Revealed: Find a non-Elite minion with at least 6 printed hit
points. Reveal it, heal all damage from it, and attach this card to it." Embody Pathos 59003 (scan): "Find an
encounter side scheme that is not in play and reveal it …". Protect Humanity 59004 (scan): "Find Amadeus Cho and put
him into play." Hecate 59042 and Roving Mobs 59045: "Find the All Versus All side scheme and reveal it."

**Rules.** RRG "Find" (p. 19): every game area is searched except facedown encounter cards in an in-play area, the
victory display and removed cards; "If a player is instructed to 'find and reveal' a minion that is already in play,
that player engages that minion and resolves any keywords and/or triggered abilities that resolve as a result of that
minion being revealed". June 2, 2026 – Ruling 2 (3): Embody Pathos can find a set-aside side scheme.

**What to build.** `findCard` gains `choose: true`: the resolving player picks one card among all that match, each
shown with the area it is in (in play, encounter deck, encounter discard pile, any set-aside area, a player's
set-aside nemesis set, a hand, a player deck or discard pile). A destination `"reveal"` runs the reveal of H3.2's
kind, or, for a minion already in play, engages it with the finder and resolves its reveal keywords and When
Revealed. Decks searched are shuffled. With no match the effect reports that it found nothing, which H3.3 reads.

**Notes for the script.** "At least 6 printed hit points" is `printedHpOf`. The 13 minions in the raw caches with a
per-player hit point value are all Elite, so the scaled-or-numeral question never arises for 59002. "Encounter side
scheme" leaves out player side schemes. Amadeus Cho already in play: nothing moves.

**Tests.** Lernean Hydra 59037 in Hercules's set-aside nemesis set and a 6-hit-point minion engaged with another
player: both offered. The set-aside Hydra chosen: revealed, engaged with Hercules, 12 hit points, Elite. The engaged
one chosen, with 4 damage: it moves to Hercules, 0 damage, 12 hit points. Lernean Hydra dealt facedown as a boost
card and nothing else eligible: nothing found (the March 6 ruling's own example).

### H3.5 A reveal that reads each per-player icon on the card as 1

> **Status: new.** No `perPlayerAs`, `perHeroAs` or like identifier exists. `perHero` / `scaled` (`dsl/values.ts`)
> always read the number of players who started the scenario.

**Cards.** Embody Pathos 59003 (scan): "Find an encounter side scheme that is not in play and reveal it, treating
each [per player] on it as 1, and attach this card to it. Place 6 additional threat on it."

**Rules.** RRG "Per Player Icon" (p. 32); "Hinder X" (p. 22): hinder threat "is in addition to any threat it normally
enters play with".

**Proposed shape.** `revealCard(target, player, { perPlayerAs: 1 })`: while that reveal resolves (starting threat,
hinder, the card's When Revealed), every per-player value **printed on that card** is multiplied by 1. A value on
another card is unaffected. Whether the reading lasts beyond the reveal is question Q19 (default: it does not).

**Tests (3 players).** All Versus All 59041 (starting threat 2, Hinder 2 per player) revealed normally: 2 + 6 = 8.
Found by Embody Pathos: 2 + 2 + 6 additional = 10. A side scheme built in the test with starting threat 3 per player:
3 + 6 = 9, not 9 + 6. A per-player value in that scheme's later Forced Response still reads 3 (Q19 = A).

### H3.6 Threat only one character's thwarts can remove

> **Status: needs extension.** `onlyCharacterRemovesThreat(target, character)` (`dsl/abilities.ts`; `RuleSpec
> threatCannotBeRemoved` with `exceptBy`; wave 7 §3.51, Technovirus Purge). It bars characters other than the named
> one and lets a support's unlabeled ability or an encounter effect remove threat (wave 7 §4.1 Q29).

**Cards.** Embody Pathos 59003 (scan): "Threat cannot be removed from attached scheme except by Hercules's thwarts."

**Rules.** RRG "Labeled Ability" (p. 26): a "(thwart)" ability is a thwart made by the player's identity. RRG
"'Cannot'" (p. 11).

**What is missing.** The printed exception is narrower than Cable's: only a thwart by Hercules. A basic thwart or a
"(thwart)"-labeled ability of his counts; an unlabeled removal on his own support, another player's thwart, an ally's
thwart and an encounter card's removal do not. Proposed: `threatCannotBeRemoved.exceptBy` gains `thwartOnly: true`.

**The sibling on 59002** needs no change: "Attached minion cannot take damage except from Hercules's attacks" is
`takesDamageOnlyFromAttacks(host, { attacker: Hercules })` (`RuleSpec cannotTakeDamage`; wave 6 §4.1 Q17: damage that
is not from an attack is blocked). "+6 hit points", "gains the Elite trait" and "gains assault" are `gets`,
`gainsTrait` and `gainsKeyword` on the host.

**Tests.** Embody Pathos on a scheme at 8 threat: Hercules's basic thwart (THW 1) leaves 7; Wisdom of Athena leaves
4; Thor ally's basic thwart (THW 3) removes 0 and the scheme is not a legal target for it; another player's thwart
event is refused that target. Defeat the Hydra's minion: Amadeus Cho's attack deals 0; Hercules's basic attack deals
3; The Gift of Battle deals 5; indirect damage and retaliate deal 0.

### H3.7 A card added to the victory display, as a trigger

> **Status: needs extension.** `TriggerEvent cardLeavesPlay` carries `to`, where the card went (`trigger-events.ts`),
> and `on.leavesPlay(who)` (`dsl/abilities.ts`) has no way to ask for a destination. `putIntoPlay`, `topOfDeck`,
> `ready`, `changeForm`, `oncePerPhase` exist.

**Cards.** Hercules 59001a (scan): "Atonement — Response: After a labor card is added to the victory display, put
the top card of the gift deck into play. Ready Hercules. You may flip to alter-ego form. (Limit once per phase.)"
Gift cards 59005–59007: "Response: After this card enters play, draw 4 cards."

**What to build.** `on.leavesPlay(who, { to: "victoryDisplay" })`. The response is on the hero face, so it is not
offered in alter-ego form (the insert: "while in hero form"). Its effects: `putIntoPlay` the top card of
`separateDeck("Gift")` under Hercules's control (a permanent upgrade put into play by a card of its own set, RRG
"Permanent", p. 32); ready; an optional `changeForm`. The flip is a card effect and does not use the player's own
change of form for the turn (RRG "Form, Change Form", p. 21).

**Tests.** Hercules defeats the Hydra's minion in the player phase: Gift deck 3 → 2, one Gift in play, 4 cards
drawn, Hercules ready, the flip offered. A second Labor card finished in the same phase: no response. With the Gift
deck empty: Hercules readies and may flip, nothing enters play. Protect Humanity's last counter removed in the
villain phase: the response is offered then.

### H3.8 "Would attack" sent to another character; "if Hercules defended"

> **Status: reusable as is (verify).** `retargetAttack` (`EffectSpec`; `attack-begin-retarget.test.ts`),
> `on.villainAttacks` / `enemyActivating` as a "would" interrupt, `atEndOfAttack`, `TriggerEvent defended`,
> `chooseTarget`, uses with Victory 0 on an obligation that stays in play (wave 9 §3.52). Not run: an obligation
> redirecting the villain onto a chosen ally and then reading who defended.

**Cards.** Protect Humanity 59004 (scan): "Forced Interrupt: When the villain would attack Hercules, choose 1 of
your allies. The villain attacks that ally instead. After that attack resolves, if Hercules defended, remove 1 labor
counter from here." Amadeus Cho 59008: "Forced Interrupt: When a minion would attack you, it attacks Amadeus Cho
instead."

**Rules.** February 20, 2026 – Ruling 3: "Hercules must have an ally in play for the Forced Interrupt to take
effect. 'After that attack resolves' refers specifically to the villain's attack redirected against his ally." RRG
"Attacks Against Allies" (p. 10): "Players may defend these attacks as normal by declaring a hero or an ally as the
defender." RRG "Defend, Defense" (p. 15): a defense-labeled ability makes the player's identity the defender, "and
is considered to have defended the attack if there is not already a defender."

**What to verify.** With no ally, nothing is redirected and no counter is removed, however Hercules defends. Both
faces are named Hercules, so the interrupt also answers an attack a card effect sends at him in alter-ego form.
Hercules defending the redirected attack takes its damage himself (he becomes the target). Herc's Helm 59015 is
"(defense)"-labeled, so using it on the redirected attack makes Hercules the defender: it counts.

**Tests.** Villain ATK 2, boost 1, Amadeus Cho (2 hit points) chosen, Hercules exhausts to defend (DEF 2): Hercules
takes 1, Amadeus takes 0, counters 3 → 2. Nobody defends: Amadeus takes 3 and is defeated, counters stay 3. No ally
in play: Hercules is attacked as normal, counters stay 3. Three defended attacks: the obligation is in the victory
display (H3.3) and Atonement is offered (H3.7).

### H3.9 Counting Gift cards; "you are considered to control none"

> **Status: reusable as is (compose).** `countOf(query(...))`, `ifElse`, `exists`, `costModifier`, `scaled`,
> `generatesAmount`, `gainKeywordUntil`, `modifyBasicPower`.

**Cards.** The Gift of Battle 59009 and Wisdom of Athena 59011 ("Reduce the cost to play this card by 1 for each
Gift card you control"), Son of Zeus 59010 (thresholds at 1, 2 and 3), Olympus 59012, Gauntlets of Hercules 59013,
Golden Mace 59014; Appeal to Athena 59035: "When counting Gift cards you control, you are considered to control
none."

**Shape.** One shared value, `giftCardsYouControl`, defined once in the Hercules module and used by all six cards: 0
while an obligation printing that sentence is in the player's play area, else the count of Gift cards the player
controls. No engine rule: the sentence is read by nothing outside this kit. If a later card counts Gift cards from
outside it, the general form is a `RuleSpec` that zeroes a controlled-card count by trait.

**Tests.** Two Gift cards: The Gift of Battle costs 1; Olympus generates 2 wild; Son of Zeus readies an upgrade and
gives a tough status card and draws nothing. With Appeal to Athena in play: 3, Olympus generates nothing, Son of Zeus
only readies Hercules, Golden Mace adds 0. The Gift cards' own bonuses (hit points, steady, retaliate) are untouched.
Shield of Perseus plus Gauntlets with two Gift cards: retaliate 1 + 2 = 3 damage to the attacker (RRG "Keywords",
p. 25: "the numbers for each instance are added together").

### H3.10 The next card of a kind costs 0

> **Status: needs extension.** `reduceNextCardCost(player, n, duration, cardFilter)` (`dsl/effects.ts`) reduces by an
> amount.

**Cards.** Recruitment Drive 59023: "Action: Discard Recruitment Drive and choose a player → reduce the resource
cost of the next ally that player plays this phase to 0."

**Shape.** `reduceNextCardCost(player, "toZero", "phase", query("ally"))`: the play's resource cost is 0 after every
other reduction, and a cost increase from another card still applies on top (it is an additional amount, not part of
"the resource cost" being set). **Test.** Thor 59020 (cost 4) costs 0; a second ally that phase costs its full cost;
the effect is unused at the end of the phase and gone.

### H3.11 A cost reduction on the cards a search found, used once per card

> **Status: needs extension.** `reduceNextCardCost` with a filter is spent by the first matching card.
> `chooseCards` binds what each player took.

**Cards.** Evaluate Threat 59028: "When Defeated: Each player may search their deck and discard pile for an Avenger
or S.H.I.E.L.D. card and add it to their hand. Reduce the cost to play each of those cards by 2 until the end of the
phase."

**Rules.** June 2, 2026 – Ruling 2 (4): the cost is reduced "for the next time it is played that phase, even if
bounced." July 9, 2026 – Ruling 3 (3): "for the next time it is played, not repeatedly."

**Shape.** A lasting cost modifier attached to each bound card instance, until the end of the phase, consumed by
that card's first play. It follows the card through a discard and a return to hand.

**Tests.** A found ally of cost 3 costs 1. Discarded and returned to hand the same phase, then played: 1. Played,
returned to hand, played again the same phase: 1, then 3. Played next phase: 3. Two players each find a card: each
card is reduced for whoever plays it.

### H3.12 A maximum on the cards tucked under a card

> **Status: needs extension.** `tuckCards(from, under)`, `tuckedUnder`, `tuckedCount(of, filter)`,
> `discardTuckedCost(under, …)`, `on.cardWouldBeTucked` (wave 9 §3.39–§3.40). Silk's limit is a state check that
> discards down to 4 after the fact; nothing refuses a tuck. `counterLimit` is the same idea for counters.

**Cards.** Ionic Physiology 58002: "Permanent. Max 3 cards tucked here." and, as errata'd, "Response: After you
play an event with a printed [energy] resource, tuck that event from your discard pile under this card. Then, heal 1
damage from your identity." Wonder Fans 58007, Signature Sunglasses 58010, "What Are You?" 58011 ("until there are 3
cards tucked there").

**Rules.** The insert, clarification 1 (H0). RRG "'Then'" (p. 44): "If the pre-'then' text of an effect does not
fully resolve, the post-'then' text does not attempt to resolve." March 6, 2026 – Ruling 3 (1): the errata lets him
"tuck a card even when at full HP". RRG "Tuck" (p. 45).

**Shape.** `constant(tuckLimit(self, 3))`: a `tuckCards` under that card tucks only up to the room left, and with no
room tucks nothing and counts as not resolved. An ability made only of such a tuck is not offered at the limit. The
printed-resource test is `printedResource: "energy"` (a wild icon is not energy, RRG "Printed", p. 35).

**Tests.** 0 tucked, Wonder Man at 12 of 12: Active Altruism is tucked, 0 healed. 2 tucked, 3 damage: the event is
tucked (3), 1 healed. 3 tucked: the response is not offered; no heal. Wonder Fans at 3 tucked offers only "Draw 1
card". "What Are You?" with 1 tucked and four energy events in the discard pile: at most 2 more.

### H3.13 Overpaid resources read by a played card; an X cost overpaid

> **Status: reusable as is (verify).** `overpaidVars` (`actions.ts`): `overpaid.total` and `overpaid.<type>`, "the
> most of that type (a wild counting as any) that can be the overpaid part, which is how the player would assign
> it"; read today by the Ant-Man and Wasp allies (`wave2/ant`, `wave2/wsp`) from a `cardEntersPlay` interrupt.
> `specialCost: "X"` and the X named in the command (`commands.ts`). `scaled(varOf(…), { max })`. Not run: an
> **event** reading its own overpayment, and a printed X cost overpaid.

**Cards.** Active Altruism 58003 ("Remove 2 additional threat … for each [energy] resource you overpaid for this
card (to a maximum of [energy][energy])"), Ionic Blast 58004 (maximum three), Starstruck 58005 ("If you overpaid for
this card with a [energy] resource"), Firebird 58012 ("If you overpaid for Firebird"), Everywhere All at Once 58018
(scan: cost X; "3 threat instead if you overpaid for this card").

**Rules.** RRG "Cost" (p. 13): "Resources generated beyond the specified cost are considered to have been overpaid
for that cost and were not paid for that cost." The insert, clarification 3: the player chooses which resources pay
and which overpay. January 17, 2026 – Ruling 4 (1): a wild resource may be named as any type "even when overpaying".

**What to verify.** The vars are on the event's play frame when its effects resolve. With a printed X the player
names X and anything generated beyond X is overpaid. A cost reduction lowers what is owed, so more is overpaid. A
card put into play, not played, overpaid nothing (Firebird by Call for Backup: no rebirth counter).

**Tests.** Ionic Blast (cost 1) paid with Energy 58023 (two energy) and Battlefield Benevolence (physical): the
physical pays, 2 energy overpaid, 3 + 4 = 7 damage (the insert's example). Paid with four energy icons: 3 overpaid,
9 damage; with five: still 9. Active Altruism (cost 0) with one energy card: 3 threat; with a physical card: 1.
Everywhere All at Once with X = 2 and exactly 2 resources: 2 threat from each of 2 schemes; with 3 resources: 3
from each. Firebird (cost 2) for 3 resources: 1 rebirth counter.

### H3.14 A resource that can only be overpaid

> **Status: needs extension.** `AbilityDefinition.generatesFor` ("generate a [wild] resource for an event",
> `abilities.ts`), `oncePerPaidCard` / `limitPerPaidCard` (`dsl/abilities.ts`), `whenSpentGenerate`,
> `takeAnyDamageCost`, `discardTuckedCost`. Not found: a resource that may not count toward the cost.

**Cards.** Mr. Hollywood 58009 (scan): "Resource: Generate a [energy] resource to overpay for a card. (Limit once
per card.)" It has no exhaust cost. Reusable siblings: Jet Belt 58008 ("generate a [energy] resource for an event"
is `generatesFor`; its second ability is an exhaust plus `discardTuckedCost(ionicPhysiology)`), Energy Siphon 58006
("Hero Interrupt: When you spend this card, take up to 3 damage → this card generates 1 additional [energy]
resource for each damage taken this way": `on.youSpendThis`, `takeAnyDamageCost`, `whenSpentGenerate`).

**Shape.** `resource(generates("energy"), { overpayOnly: true, limit: oncePerPaidCard })`. The resource is added to
the payment after the cost is covered by other resources and is always part of `overpaid.*`. A payment that needs it
to reach the cost is refused. Which payments it may join is question Q20 (default: a card being played).

**Tests.** Active Altruism with an empty hand and Mr. Hollywood: 1 energy overpaid, 3 threat removed. Starstruck
(cost 1) with only Mr. Hollywood: refused. Two events in one turn: usable for each. Twice for one card: refused.
Energy Siphon taking 3: 1 + 3 = 4 energy and 3 damage on Wonder Man; with a tough status card no damage is taken,
so nothing is added (`takeAnyDamageCost` decides whether the cost counts as paid, as it does today).

### H3.15 Deck building: off-aspect cards by printed resource

> **Status: needs extension.** `IdentityDeckbuilding.offAspectAllowance` with `cardType`, `anyTrait`, `maxCards`
> (`identity.ts`; Gamora, Cyclops, Cable), read by `validateDeck` and `cardOfferedToDeck` through
> `matchesOffAspectAllowance` (`deck.ts`).

**Cards.** Simon Williams 58001b (H1.5).

**Shape.** `OffAspectAllowance.printedResource?: "physical" | "mental" | "energy" | "wild"`: the card prints at least
one icon of that type. ANDed with `cardType`; a wild icon is only wild (RRG "Printed", p. 35). No `maxCards`.

**Tests.** Wonder Man with Justice: Bombs Away 58017 (Aggression, energy) is legal at 3 copies; an Aggression event
printing physical is refused; an Aggression ally printing energy is refused (not an event); a Protection event
printing only a wild icon is refused; `cardOfferedToDeck` answers `via: "allowance"` for Bombs Away.

### H3.16 An additional cost to attack one enemy

> **Status: needs extension.** `additionalPowerCost(character, powers, resources)` (`dsl/abilities.ts`; wave 9
> §3.31) is scoped by who uses a basic power and takes a resource cost; `basicPowerCost` (`costModifier`
> `basicPowerCosts`) puts a cost on one character's own basic powers (the `cap` pack's Wonder Man ally). Neither is
> scoped by the attack's target, and neither reaches an attack event.

**Cards.** Brother vs. Brother 58027: "As an additional cost to attack Grim Reaper, you must discard 1 card from
your hand."

**Rules.** RRG "Cost" (p. 13): "If multiple costs for a single card or ability require payment, those costs must be
paid simultaneously." RRG "Labeled Ability" (p. 26).

**Shape.** `RuleSpec additionalAttackCost { target, cost: AbilityCost }`: any attack a player makes that names a
matching enemy as a target, a basic attack by a hero or an ally and an "(attack)"-labeled ability alike, carries the
cost, paid by the attacking character's controller with the attack's own costs. An attack that cannot pay may not
choose that enemy. Damage that is not an attack is free.

**Tests.** A basic attack on Grim Reaper with 1 card in hand: the card is discarded and the attack is made; with an
empty hand Grim Reaper is not a legal target and Wonder Man does not exhaust. Ionic Blast as the last card in hand:
refused against Grim Reaper, legal against the villain. An ally's attack: its controller discards. Hawkeye 58013's 2
damage (not an attack): no cost.

### H3.17 Healing damage from a chosen character as a cost

> **Status: needs extension.** `healYourIdentityCost` (`dsl/abilities.ts`; `AbilityCost`: "the controller's identity
> must have that much damage to heal").

**Cards.** Battlefield Benevolence 58016: "Hero Action: Heal 2 damage from an enemy → confuse that enemy."

**Shape.** `healCost(target, n, { bind })`: the payer picks one matching character with at least `n` damage; that
damage is healed as the cost and the pick is bound for the effect ("that enemy"). An enemy that cannot be healed
(`cannotBeHealed`) or cannot take the status the effect needs is no candidate (RRG "Cost", p. 14: an ability whose
effect needs a target cannot have its cost paid without one).

**Tests.** An enemy with 1 damage only: the event cannot be played. An enemy with 5: 3 left, confused. A stalwart
villain: not a candidate.

### H3.18 A collection search for an ally of an identity not in the game

> **Status: needs extension.** `searchCollection(filter, bind)` and `CollectionSearchFilter` (`spec.ts`; wave 7
> §3.81: the collection is the game's card pool, a card must still have a copy outside the game, owner decision Q47 =
> A), `heroTitleNotInPlay` (wave 9 §3.30), the `setup` keyword on a player card and Setup abilities at step 16
> (`setup-keyword-set-aside.test.ts`), `moveCards` into the deck, `discardFromHand`, removal from the game.

**Cards.** Cameo 58031 (scan): "Setup. Max 1 per deck. Setup: Search your collection for an identity-specific ally
for an identity not in this game. Shuffle that ally into your deck. Discard 2 cards from your hand and remove this
card from the game."

**Rules.** The insert, clarification 2 (H0). RRG Appendix II (p. 51): step 11 "Put Setup Cards Into Play", step 16
"Resolve Player Setup Abilities", after the mulligan of step 15. March 19, 2026 – Ruling 6: unique cards added during
setup "can share titles with cards in player decks"; the in-play unique rule still applies. RRG "Classifications"
(p. 12).

**Shape.** `CollectionSearchFilter.identitySpecificToUnseated: true`: an ally whose classification is
identity-specific and whose identity is not one a player is using in this game.

**Tests.** A 40-card deck holding Cameo, hand 6 after the mulligan: Cameo is in play at step 11; at step 16 Amadeus
Cho 59008 is offered when nobody plays Hercules and is not when somebody does; after it resolves the hand is 4, the
discard pile 2, the deck 40 − 1 − 6 + 1 = 34, and Cameo is removed from the game. Two players with Cameo cannot both
take the one copy.

### H3.19 Any player may help pay the costs on a card

> **Status: new.** `AttachmentHost { kind: "encounterCard" }` exists for the card's attach line (wave 2 §7.2;
> `attachment-hosts.ts`). No rule lets a second player contribute to a payment; `spendableForAnyPlayer` and
> `spendableFromTucked` make one card spendable by others, which is a different thing.

**Cards.** Coordinated Effort 58032: "Attach to an encounter card in play. Max 1 per encounter card. While paying
costs on attached card, any player may help pay those costs."

**Rules.** RRG "Cost" (pp. 13–14); "Resource Ability" (p. 37).

**Proposed shape.** `RuleSpec costsPayableByAnyPlayer { card }`. While a player pays the cost of an ability printed
on the attached card, the pay prompt accepts resources from every player: each other player, in player order, may
add cards from their own hand and their own resource abilities to the one payment. The payment is still one payment
by the player using the ability (types, overpayment and "paid with" readers see all of it). Which kinds of cost are
shared is question Q21 (default: resource costs).

**Tests.** Appeal to Athena 59035 with Coordinated Effort attached, Hercules's hand empty: another player spends a
Genius (two mental) and the obligation is removed from the game. Without the upgrade: refused. A cost on another
encounter card: not shared.

### H3.20 A defender declared after the boost cards are turned up

> **Status: needs extension.** `declareDefender(character, { exhaust })` (`dsl/effects.ts`; wave 4 §3.22),
> `TriggerEvent boostCardTurnedFaceup`, `undefendedAttack` (`dsl/values.ts`). Every use so far declares the defender
> before the boost step.

**Cards.** Swordsman 58022: "Hero Response: After a boost card is turned faceup during an undefended attack, declare
Swordsman as the defender without exhausting him."

**Rules.** RRG "Defend, Defense" (p. 15): a declared ally "becomes the defender of the attack"; "A card ability that
allows an ally to be declared as a defender without exhausting can be used on an exhausted ally"; "When an ally
defends an attack, that ally becomes the target character for that attack". RRG "Attack (Enemy Activation)" (p. 8).

**What to build.** A response to `boostCardTurnedFaceup` while the attack in progress has no defender may call
`declareDefender`: from then on the attack is defended, Swordsman is its target and takes its damage, and boost
cards still to turn are turned as usual. A boost ability already resolved is not undone.

**Tests.** Villain ATK 2 attacks a hero, nobody defends, the boost card shows 1 icon: Swordsman (4 hit points) is
declared, takes 3, stays ready, and the hero takes 0. An exhausted Swordsman: still declared. A defended attack: no
response. In alter-ego form: no response (Hero Response).

### H3.21 Rulings and errata on behavior the engine already covers

> **Status: reusable as is (verify).** One ruling test each (`rules-qa-engineer`).

- **March 6, 2026 – Ruling 4** and **June 19, 2026 – Ruling 1** (Leading Blow, and Teamwork 59021, with Wonder Man's
  basic attack): the event played as an interrupt to the basic attack is tucked when it reaches the discard pile;
  "Wonder Man's constant ability immediately updates his ATK bonus"; the damage is dealt at the new value; the Forced
  Response then discards the tucked cards. So the attack's ATK is read when damage is dealt, not when the attack is
  declared. Test: ATK 1, two cards tucked, Teamwork with an ATK 2 ally: tucked makes three, 1 + 3 + 2 = 6 damage,
  then 0 tucked.
- **February 8, 2026 – Ruling 2** (Golden Mace 59014 and Prince of Power 59017 against a 3-hit-point minion that
  reduces damage taken by 1, with three Gift cards): 6 dealt, 5 taken, 2 overkill to the villain, 3 healed.
  `resolve/event.ts` already cites it; the test uses the ruling's numbers.
- **January 17, 2026 – Ruling 4 (1)**: a wild resource overpaid is named as a type (H3.13).
- **January 26, 2026 – Ruling 2** and **June 2, 2026 – Ruling 1**: an ally Cameo brought in behaves as any copy of
  that ally does (counter types by the card they sit on; lasting effects by title).
- **Errata p. 70** (H1.4) and **FAQ p. 65** (H3.3).

### H3.22 Reusable as is (checked by name against the engine unions and the DSL)

The identifier and its doc comment were read; the scripting agent's tests prove each.

- **Wonder Man's kit.** `gets` with `tuckedCount` (+1 ATK per tucked card); `forcedResponse(on.basicPowerUsed)` with
  `discard(tuckedUnder(…))`; `setup` putting a permanent into play (wave 6 §3.74); `cannotAttack` with `attacker`
  (Pacifism: every attack of his, an "(attack)" event included; his allies still attack); `eitherCost` with
  `exhaustYourHero` and `discardTuckedCost(…, { min: 3 })`; a "would be defeated … instead" interrupt with
  `setRemainingHitPoints(4)`, `changeForm` and removal from the game (wave 9 §3.5; `would-be-defeated-tier.test.ts`);
  `on.youChangeForm`; `chooseOne`; a tucked card returned to hand (`moveCards`).
- **Wonder Man's nemesis set.** Quickstrike; `on.defeats` with the defeated ally's controller and
  `dealEncounterCard`; `enemyAttack` with `afterCurrentActivation` (Death Cannot Die's boost); `searchAndReveal`
  (find and reveal Grim Reaper); `dealIndirectDamage`.
- **The Wonder Man pack's other cards.** `resolveWhenRevealedOf` on a card discarded from the encounter deck
  (Scarlet Witch 58014; only the When Revealed, no surge); `searchAndReveal` with a fallback (Sentry 58015);
  `preventDamage` by `statOf(…, "def")` with `sharesTraitWithHeroOf` (Stronger Together 58019); `modifyBasicPower`
  plus `cancelConsequentialDamage` (Unified Strike 58020, the mirror of Teamwork); `on.attacks` by a friendly
  character (Caught in the Crossfire 58030); `printsAbility(["action", "response"], "hero")` (Disarming Defense
  58033; its doc quotes this text); `playTuckedCard` (Avengers Compound 58034, as Med Lab); `on.playerChangesForm`
  with `modifyStatOf` until the end of the phase and `removeStatus` (Jarvis 58024); counters with a cost
  (`removeCounter`) and `on.basicPowerUsed` by an ally (Hawkeye 58013); a would-be-defeated interrupt limited to
  consequential damage (Firebird 58012; `dealDamage.consequential`); `attacksGainKeywords` (Swordsman's piercing).
- **Hercules's kit.** `temporary` (`keyword-abilities.ts`, `temporary.test.ts`); `gainKeywordUntil` to the end of
  the attack (Gauntlets); `modifyBasicPower` with `thatAttackGainsKeywords` (Golden Mace); `reducesAttackDamageTaken`
  or `modifyAttack` under a "(defense)" label (Herc's Helm); `defeatExcessDamage` (Prince of Power); `gainsKeyword`
  steady and retaliate on the identity, `attacksGainKeywords` with `basicOnly`, `restrictedLimit` (the Gift cards);
  `on.entersPlay("self")` with `draw(4)`.
- **Hercules's nemesis set.** `on.enemySchemes` with `dealEncounterCard` (Ares); `chooseOne` between
  `spendResources` and `heal` (Lernean Hydra; who "you" is, Q22); `countOf` by trait in play (Olympic Feud);
  `attachInstruction` with an "otherwise" host and a response reading whether the attack damaged a friendly character
  (Ares's Axe); `forEachCard` over engaged minions with `enemyAttack`, then `discardEncounterUntil` and a reveal (God
  of War; the attack is made whatever the player's form, as the reminder text says).
- **The Hercules pack's other cards.** `modifyConsequentialDamage` behind `dealDamageCost` (Deathcry 59018); `gets`
  hit points by a count (Namora 59019); `discardEncounterUntil` then `putIntoPlay` engaged, with no reveal (Thor
  59020); `on.attachedCardDefeated` (59024); `costIf` with `giveStatusCost` (Gilgamesh 59025); the `teamUp` keyword,
  `teamUpCharacters` and "Max 1 per deck" (Ancient Rivalry 59026; wave 9 §3.10; `docs/team-ups.md`); the reprints.
- **All Versus All.** `gainsKeywordX("hinder")` is not needed: hinder is printed. `on.defeated` for any character;
  a When Defeated that sets the scheme aside (`setAside`, `replaceLeaveDestination`); "Find … and reveal it" for a
  set-aside scheme, and for one already in play, where it does nothing (wave 9 §3.63); a Forced Response with an
  "otherwise" branch (Kyknos: the main scheme only when All Versus All is not in play, RRG "'Otherwise'", p. 31);
  toughness, retaliate, Victory 0 on a minion; `attacksGainKeywords` piercing and ranged (Bewitched Officer).

---

## H4. Open questions for the owner

**Answered 2026-10-11 (owner): 3B, 19A, 20A, 21B, 22A**, all provisional. 3B is built: a Labor card with no target is
discarded (the discard is announced; RRG 1.8 p. 65, later than the March 6, 2026 ruling) and ends on the bottom of
the Labor deck. 21B is built as an interpretation: other players may pay any part of the cost their own cards can
pay, except a part naming the user's own card (the wording matches Alliance, RRG p. 5). Details:
`docs/phase7-wave10.md` §4.0. Where H3 or H7 below describes 3A or 21A, the B answer replaces it.

Numbered across the wave's pages; this page's are 19 to 22. Until answered, **A is what gets built**. The main session records answers in the main spec's §4.1 table and the PR.

| Q   | Question                                                          | A (default)                                  | B                                        | Decision |
| --- | ----------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------- | -------- |
| 3   | A Labor card revealed with no valid target (main spec question 3) | Bottom of the Labor deck, not "discarded"    | Discarded, then bottom of the Labor deck | open     |
| Q19 | Embody Pathos: how long is each per-player icon read as 1?        | Only while the side scheme is being revealed | For as long as the scheme is in play     | open     |
| Q20 | Mr. Hollywood: which payments may it overpay?                     | Only a card being played                     | Any cost on a card, abilities included   | open     |
| Q21 | Coordinated Effort: which costs may other players help pay?       | Resource costs only                          | Every kind of cost they are able to pay  | open     |
| Q22 | Lernean Hydra: whose attacks trigger "a character you control"?   | Any player's; the attacking player chooses   | Only the engaged player's characters     | open     |

**3. A Labor card with no target** (main spec question 3; still open). Defeat the Hydra 59002 is revealed and no
non-Elite minion with 6 printed hit points can be found (the ruling's example: Lernean Hydra has been dealt facedown
as a boost card). March 6, 2026 – Ruling 3 (2): "If a Labor card cannot enter play, place it on the bottom of the
Labor deck." RRG p. 65, published later: "That Labor card is discarded. Any time a Labor card leaves play other than
being placed in the victory display, place it on the bottom of the Labor deck." The card ends in the same place
either way. The ruling and the RRG differ on whether a discard happened on the way.
A: it goes straight to the bottom of the Labor deck; nothing that answers "discarded" hears it. B: it is discarded
(the event is raised) and the discard is then replaced by the bottom of the Labor deck.

**Q19. Embody Pathos 59003.** "Find an encounter side scheme that is not in play and reveal it, treating each
[per player] on it as 1". RRG "Per Player Icon" (p. 32); "Hinder X" (p. 22). Three players; the scheme prints
starting threat 2 per player and "Forced Response: After …, place 1 per player threat here."
A: the reading covers the reveal: starting threat 2 (not 6), hinder, and the scheme's When Revealed; the Forced
Response later places 3. B: every per-player value on the scheme reads 1 while it stays in play; the Forced Response
places 1.

**Q20. Mr. Hollywood 58009.** "Resource: Generate a [energy] resource to overpay for a card. (Limit once per
card.)" RRG "Cost" (p. 13): "Resources generated to pay for an ability on a card are considered to have been paid
for that card." Wonder Man uses Wonder Fans, or pays "spend [mental][mental]" on an obligation.
A: Mr. Hollywood is offered only while a card is being played, which is where "overpaid for this card" is read.
B: it is offered for any payment on a card, so anything that answers a resource being generated can hear it then.

**Q21. Coordinated Effort 58032.** "While paying costs on attached card, any player may help pay those costs."
Attached to an encounter card whose ability reads "Hero Action: Exhaust your hero and spend 2 resources → discard
this card."
A: other players may add resources to the payment; exhausting, discarding and damage stay with the player using the
ability. B: another player may also pay any other part of the cost that their own cards can pay (a discard from
their hand, damage to their identity); a part naming the user's own card, such as "exhaust your hero", stays with
the user.

**Q22. Lernean Hydra 59037.** "Forced Response: After a character you control attacks and damages Lernean Hydra,
choose: Spend a [physical] resource. / Lernean Hydra heals 2 damage." RRG "You, Your" (p. 49) does not say who "you"
is on a minion's response to a player's attack. The Hydra is engaged with Hercules and another player's ally attacks
it for 2.
A: "you" is the player whose character attacked: that player chooses, and the Hydra heals 2 unless they spend.
B: only the engaged player's characters trigger it: the other player's ally damages it with no response.

---

## H5. Notes for the other agents

**Deck building (`validateDeck`, `requiredIdentitySet`, `packages/engine/src/deck.ts`).**

- **Hercules.** `requiredIdentitySet` already leaves out cards with `separateDeck`, so it returns the 15 kit cards
  (59008–59017 at their set quantities) and never the Gift cards. The Labor cards are encounter cards and are not
  members at all. Neither deck counts toward the 40 to 50; `validateDeck` refuses any of the six in a card list.
  Today it also reports `unsupported_identity` for him; H3.1 removes that. The deck builder shows the two decks as
  fixed, read-only parts of the identity (as it shows the Invocation deck).
- **Wonder Man.** Ionic Physiology is permanent: required, and not counted toward deck size (`isPermanentCard`).
  The off-aspect allowance is H3.15; without it a legal Wonder Man deck with off-aspect energy events is refused.
- **Ancient Rivalry 59026.** Team-Up (Hercules and Thor), Max 1 per deck: legal only for an identity titled Hercules
  or Thor (`teamUpOf` in `deck.ts`), one copy. The pack prints two copies so that each of the two heroes can hold
  one. Add the pair to `docs/team-ups.md` (folder `hercules-thor`; no pictures yet).
- **Cameo 58031** is a legal Leadership card for anyone (Max 1 per deck); the ally it adds is never in the decklist.
  **Avengers Compound**, **Evaluate Threat** and **"Avenge Me!"** carry "Play only if" lines, which do not limit
  deck building.
- **"Teamwork" 59021** is the player event (a reprint of 06032), not the Teamwork (Trait) keyword of the main spec's
  §3.9. The glossary and any keyword parser must not confuse them.

**`card-data-pipeline`.** H8.1.

**`ability-scripting-engineer`.** H8.4. Copy the card's own word where the packs separate two things: "Hercules's
attacks" and any damage; "thwarts" and removing threat; "play" and "put into play" (Firebird's counter, Atonement's
Gift); "overpaid" and "paid"; "defeated" and "leaves play" (the Labor cards); "you control" for Gift cards.

**`encounter-ai-designer`.** Nothing to decide for the villain. The first player's choices: none new. The Hercules
player makes every Labor choice. Kyknos and Hecate use the normal activation flow.

**`rules-qa-engineer`.** One test per ruling in H3.21; the FAQ p. 65 and errata p. 70 tests; February 20, 2026 –
Ruling 3 (H3.8); June 2, 2026 – Ruling 2 (3) and (4) (H3.4, H3.11); July 9, 2026 – Ruling 3 (3); March 19, 2026 –
Ruling 6 (H3.18). A Hercules game against a scenario whose encounter deck has no 6-hit-point non-Elite minion and no
side scheme, to exercise H3.3. All Versus All in the modular matrix. Hercules the hero against the Civil War minion
Hercules 56151 belongs to the main spec's §3.8.

**`game-client-engineer`.** New things a player must see:

- **Hercules:** two facedown decks in his play area with a label and a count each, not inspectable; the "New Labors
  of Hercules" action and why it is unavailable (hero form, a Labor card in play, an empty deck); the find prompt
  listing candidates with the area each is in; a Labor attachment on a minion or a side scheme marked as Hercules's;
  labor counters; the Labor cards in the victory display; the Gift count on the cards that read it, and 0 with the
  reason while Appeal to Athena is in play.
- **Wonder Man:** cards tucked under Ionic Physiology, faceup and inspectable, with the count against 3 and the ATK
  bonus; in the pay prompt, the amount overpaid by type and what the card will do with it; Mr. Hollywood as a
  payment option only once the cost is covered; an X chosen before paying (58018).
- **Both:** rebirth and arrow counters; a helper's contribution in a shared payment (Coordinated Effort); the
  Hercules and Thor Team-Up ring. A Guided mode tip for the Labor and Gift decks, for tucking and the basic attack
  that spends the tucks, and for overpaying (`docs/wave-definition-of-done.md` §5).

---

## H7. Card coverage

Every record of both packs. "DSL" means vocabulary named in H3.22 or found by name this session. A blocker is an
H8.2 task (HT) or an open question.

### H7.1 Wonder Man (`wonder_man`): the hero kit, obligation and nemesis set

| Id     | Title                | Type        | Needs                                                   | Blocker   |
| ------ | -------------------- | ----------- | ------------------------------------------------------- | --------- |
| 58001a | Wonder Man           | hero        | DSL (`tuckedCount`, `basicPowerUsed`); H3.21            | none      |
| 58001b | Simon Williams       | alter-ego   | H3.15 (deck rule); DSL (`setup`)                        | HT12      |
| 58002  | Ionic Physiology     | upgrade     | H3.12; errata p. 70                                     | HT10      |
| 58003  | Active Altruism      | event       | H3.13                                                   | none      |
| 58004  | Ionic Blast          | event       | H3.13                                                   | none      |
| 58005  | Starstruck           | event       | H3.13                                                   | none      |
| 58006  | Energy Siphon        | resource    | DSL (H3.14 siblings)                                    | none      |
| 58007  | Wonder Fans          | support     | H3.12; DSL (`chooseOne`)                                | HT10      |
| 58008  | Jet Belt             | upgrade     | DSL (`generatesFor`, `discardTuckedCost`)               | none      |
| 58009  | Mr. Hollywood        | upgrade     | H3.14                                                   | HT11; Q20 |
| 58010  | Signature Sunglasses | upgrade     | H3.12; DSL (`on.youChangeForm`)                         | HT10      |
| 58011  | "What Are You?"      | upgrade     | H3.12; DSL (would be defeated, `setRemainingHitPoints`) | HT10      |
| 58025  | Pacifism             | obligation  | DSL (`cannotAttack`, `eitherCost`)                      | none      |
| 58026  | Grim Reaper          | minion      | DSL (quickstrike, `on.defeats`)                         | none      |
| 58027  | Brother vs. Brother  | side scheme | H3.16                                                   | HT13      |
| 58028  | Scythe Strike        | treachery   | DSL (`enemyActivates`, indirect damage)                 | none      |
| 58029  | Death Cannot Die     | treachery   | DSL (`searchAndReveal`, `afterCurrentActivation`)       | none      |

### H7.2 Wonder Man (`wonder_man`): the pack's other cards

| Id    | Title                   | Type     | Aspect     | Needs                                              | Blocker   |
| ----- | ----------------------- | -------- | ---------- | -------------------------------------------------- | --------- |
| 58012 | Firebird                | ally     | Justice    | H3.13; DSL (rebirth counter, consequential defeat) | none      |
| 58013 | Hawkeye                 | ally     | Justice    | DSL (arrow counters, an ally's basic thwart)       | none      |
| 58014 | Scarlet Witch           | ally     | Justice    | DSL (`resolveWhenRevealedOf`)                      | none      |
| 58015 | Sentry                  | ally     | Justice    | DSL (`searchAndReveal`, 6 threat otherwise)        | none      |
| 58016 | Battlefield Benevolence | event    | Justice    | H3.17                                              | HT14      |
| 58017 | Bombs Away              | event    | Aggression | none (reprint of 42029)                            | none      |
| 58018 | Everywhere All at Once  | event    | Justice    | H3.13 (X cost)                                     | none      |
| 58019 | Stronger Together       | event    | Protection | DSL (`sharesTraitWithHeroOf`, `preventDamage`)     | none      |
| 58020 | Unified Strike          | event    | Leadership | DSL (`modifyBasicPower`, no consequential damage)  | none      |
| 58021 | Heroic Conditioning     | upgrade  | Justice    | DSL (`anyPlayerControl`, Max 1 per player)         | none      |
| 58022 | Swordsman               | ally     | Basic      | H3.20                                              | HT17      |
| 58023 | Energy                  | resource | Basic      | none (reprint of 01088)                            | none      |
| 58024 | Jarvis                  | support  | Basic      | DSL (`on.playerChangesForm`)                       | none      |
| 58030 | Caught in the Crossfire | upgrade  | Aggression | DSL (attach to a minion; friendly attack)          | none      |
| 58031 | Cameo                   | support  | Leadership | H3.18                                              | HT15      |
| 58032 | Coordinated Effort      | upgrade  | Leadership | H3.19                                              | HT16; Q21 |
| 58033 | Disarming Defense       | event    | Protection | DSL (`printsAbility`)                              | none      |
| 58034 | Avengers Compound       | support  | Basic      | DSL (`playTuckedCard`)                             | none      |

### H7.3 Hercules (`hercules`): the hero kit, the two decks, obligation and nemesis set

| Id     | Title                 | Type        | Needs                                                          | Blocker      |
| ------ | --------------------- | ----------- | -------------------------------------------------------------- | ------------ |
| 59001a | Hercules              | hero        | H3.7 (Atonement)                                               | HT1, HT7     |
| 59001b | Hercules              | alter-ego   | H3.1, H3.2 (New Labors)                                        | HT1, HT2     |
| 59002  | Defeat the Hydra      | attachment  | H3.3, H3.4; DSL (`takesDamageOnlyFromAttacks`, +6, Elite)      | HT1–HT4; Q3  |
| 59003  | Embody Pathos         | attachment  | H3.3, H3.4, H3.5, H3.6                                         | HT1–HT6; Q19 |
| 59004  | Protect Humanity      | obligation  | H3.3, H3.8; DSL (`findCard` to play, uses, Victory 0)          | HT1–HT3      |
| 59005  | Nemean Lion Skin      | upgrade     | DSL (permanent, +2 hit points, steady, draw 4)                 | HT1          |
| 59006  | Shield of Perseus     | upgrade     | DSL (+1 hit point, retaliate 1, draw 4)                        | HT1          |
| 59007  | Sword of Peleus       | upgrade     | DSL (restricted, piercing on basic attacks, draw 4)            | HT1          |
| 59008  | Amadeus Cho           | ally        | H3.8                                                           | none         |
| 59009  | The Gift of Battle    | event       | H3.9                                                           | none         |
| 59010  | Son of Zeus           | event       | H3.9                                                           | none         |
| 59011  | Wisdom of Athena      | event       | H3.9                                                           | none         |
| 59012  | Olympus               | support     | H3.9 (`generatesAmount`)                                       | none         |
| 59013  | Gauntlets of Hercules | upgrade     | H3.9; DSL (`gainKeywordUntil` retaliate)                       | none         |
| 59014  | Golden Mace           | upgrade     | H3.9; H3.21 (Feb 8 ruling)                                     | none         |
| 59015  | Herc's Helm           | upgrade     | DSL ("(defense)" interrupt, −1 damage); H3.8                   | none         |
| 59016  | Lion of Olympus       | upgrade     | DSL (temporary, +1/+1/+1)                                      | none         |
| 59017  | Prince of Power       | upgrade     | DSL (`defeatExcessDamage`); H3.21                              | none         |
| 59035  | Appeal to Athena      | obligation  | H3.9; DSL (`eitherCost`, removal from the game)                | none         |
| 59036  | Ares                  | minion      | DSL (retaliate 1, `on.enemySchemes`)                           | none         |
| 59037  | Lernean Hydra         | minion      | DSL (`chooseOne`, `spendResources`, heal 2)                    | Q22          |
| 59038  | Olympic Feud          | side scheme | DSL (count of Olympus cards in play)                           | none         |
| 59039  | Ares's Axe            | attachment  | DSL (attach to Ares, otherwise the villain)                    | none         |
| 59040  | God of War            | treachery   | DSL (each minion attacks; else discard until a minion, reveal) | none         |

### H7.4 Hercules (`hercules`): the pack's other cards and All Versus All

| Id    | Title             | Type               | Aspect / set   | Needs                                           | Blocker |
| ----- | ----------------- | ------------------ | -------------- | ----------------------------------------------- | ------- |
| 59018 | Deathcry          | ally               | Leadership     | DSL (`modifyConsequentialDamage`)               | none    |
| 59019 | Namora            | ally               | Leadership     | DSL (hit points by a count)                     | none    |
| 59020 | Thor              | ally               | Leadership     | DSL (`discardEncounterUntil`, put into play)    | none    |
| 59021 | Teamwork          | event              | Leadership     | none (reprint of 06032); H3.21                  | none    |
| 59022 | Call for Backup   | player side scheme | Leadership     | none (reprint of 40018)                         | none    |
| 59023 | Recruitment Drive | support            | Leadership     | H3.10                                           | HT8     |
| 59024 | "Avenge Me!"      | upgrade            | Leadership     | DSL (`on.attachedCardDefeated`)                 | none    |
| 59025 | Gilgamesh         | ally               | Basic          | DSL (`costIf`, `giveStatusCost`)                | none    |
| 59026 | Ancient Rivalry   | event              | Basic          | DSL (Team-Up, Max 1 per deck)                   | none    |
| 59027 | Limitless Stamina | event              | Basic          | none (reprint of 31023)                         | none    |
| 59028 | Evaluate Threat   | player side scheme | Basic          | H3.11                                           | HT9     |
| 59029 | Energy            | resource           | Basic          | none (reprint of 01088)                         | none    |
| 59030 | Genius            | resource           | Basic          | none (reprint of 01089)                         | none    |
| 59031 | Strength          | resource           | Basic          | none (reprint of 01090)                         | none    |
| 59032 | Avengers Compound | support            | Basic          | none (reprint of 58034)                         | none    |
| 59033 | Helicarrier       | support            | Basic          | none (reprint of 01092)                         | none    |
| 59034 | Quincarrier       | support            | Basic          | none (reprint of 08023)                         | none    |
| 59041 | All Versus All    | side scheme        | All Versus All | DSL (hinder, any character defeated, set aside) | none    |
| 59042 | Hecate            | minion             | All Versus All | DSL (find and reveal, wave 9 §3.63)             | none    |
| 59043 | Kyknos            | minion             | All Versus All | DSL ("otherwise" branch, toughness, Victory 0)  | none    |
| 59044 | Bewitched Officer | minion             | All Versus All | DSL (`attacksGainKeywords` piercing, ranged)    | none    |
| 59045 | Roving Mobs       | side scheme        | All Versus All | DSL (Victory 0, find and reveal)                | none    |

---

## H8. Build order

Data first (H8.1), then the engine tasks one at a time (H8.2), then the scripting modules (H8.4), which may run up
to three at once where their files do not overlap. There is no H8.3: nothing of this pass sits in a "verify" queue of
its own; the verify rows of H3 are proven by the scripting agent's tests.

### H8.1 Data corrections owed (`card-data-pipeline`)

1. **Ionic Physiology 58002:** `text.current` to the RRG p. 70 wording, through the curation's `errata` (H1.4).
2. **Simon Williams 58001b:** `deckbuilding.offAspectAllowance` (H1.5), after HT12 lands the field.
3. **Hercules's `separateDecks`** on 59001a (H1.1); the Labor cards emitted as encounter cards with `separateDeck:
   "Labor"` and no encounter set; a legal attachment record with no attach rule for 59002 and 59003 (survey gap G6).
4. **59004 is not the identity's obligation:** only 59035 is shuffled into the encounter deck for Hercules.
5. **Register and emit `hercules`**; move `wonder_man` from `DATA_ONLY_*` to the wave's playable block once scripted.
6. **Counter types** `labor` and `rebirth` (H1.2); the keyword and icon rows of H1.3 checked on the emitted records.
7. **Reprint mappings** of H1.6; 59032 reuses 58034's picture.
8. **Starter decks:** both curations have `starterDecks: []`. The decklists come from the packs' printed decklist
   cards; Ancient Rivalry is one copy in a deck.
9. **`docs/team-ups.md`:** the Hercules and Thor row.
10. **All Versus All** in the modular pool; the two nemesis sets on their identities.

### H8.2 Engine tasks (`game-rules-architect`), one primitive each

None of the new identifiers (`perPlayerAs`, `thwartOnly`, `tuckLimit`, `overpayOnly`, `printedResource` on an
allowance, `additionalAttackCost`, `healCost`, `identitySpecificToUnseated`, `costsPayableByAnyPlayer`, a `choose`
option on `findCard`, a `to` option on `on.leavesPlay`, `"toZero"`) exists in the engine or the DSL (grep, this
session). "After N" names a dependency.

| Task | Title                                                                                   | Section | After |
| ---- | --------------------------------------------------------------------------------------- | ------- | ----- |
| HT1  | Build an identity's separate deck of encounter cards; owned encounter instances         | H3.1    |       |
| HT2  | Reveal the top card of a separate deck; an attachment revealed with no attach line      | H3.2    | HT1   |
| HT3  | Labor card routing: bottom of its deck, the three ways to the victory display           | H3.3    | HT1   |
| HT4  | `findCard` with a choice, across areas; find and reveal a minion already in play        | H3.4    |       |
| HT5  | `perPlayerAs` on a reveal                                                               | H3.5    |       |
| HT6  | `threatCannotBeRemoved` with a thwart-only exception                                    | H3.6    |       |
| HT7  | A destination on the leaves-play trigger ("added to the victory display")               | H3.7    |       |
| HT8  | `reduceNextCardCost` to 0                                                               | H3.10   |       |
| HT9  | A cost reduction bound to found cards, once per card, until the end of the phase        | H3.11   |       |
| HT10 | `tuckLimit`: a tuck refused at the maximum                                              | H3.12   |       |
| HT11 | A resource ability that can only be overpaid                                            | H3.14   |       |
| HT12 | `OffAspectAllowance.printedResource` in the schema, `validateDeck`, `cardOfferedToDeck` | H3.15   |       |
| HT13 | `additionalAttackCost` scoped by the attacked enemy                                     | H3.16   |       |
| HT14 | `healCost` on a chosen character                                                        | H3.17   |       |
| HT15 | A collection filter for an identity-specific ally of an unseated identity               | H3.18   |       |
| HT16 | `costsPayableByAnyPlayer`: a payment other players add to                               | H3.19   |       |
| HT17 | `declareDefender` after a boost card is turned faceup                                   | H3.20   |       |

Order: HT1, HT2, HT3 first (Hercules cannot be seated without HT1); HT10 and HT12 next (Wonder Man's identity); the
rest in any order. HT16 is the largest and blocks one card.

### H8.4 Scripting modules (`ability-scripting-engineer`), one module per line

Paths are relative to `packages/cards/src/wave10/`. "Waits on" lists H8.2 tasks; a line with none can start once its
pack's data is emitted. The wave's scaffold (registries, `card-groups.ts`, the coverage guard, `reprints.ts`) is the
main spec's §8.4 line 1; the two packs add their entries to it in line HS0.

- **HS0.** Registry entries for `wonder_man` and `hercules` in the wave scaffold; reprint rows (58017, 58023, 59021,
  59022, 59027, 59029–59034). Waits on nothing.

Wonder Man (`wonder_man/wonder-man/`):

- **HS1.** `identity` (58001a/b, 58002). Waits on HT10; its starter-deck legality test on HT12.
- **HS2.** `events` (58003–58006; Energy Siphon is a resource card and lives here). Waits on nothing.
- **HS3.** `support-upgrades-allies` (58007–58011). Waits on HT10 and HT11; Q20 at its default.
- **HS4.** `obligation-nemesis` (58025–58029). Waits on HT13.
- **HS5.** `wonder_man/justice` (58012–58016, 58018, 58021). Waits on HT14.
- **HS6.** `wonder_man/other-aspects` (58019, 58020, 58030–58033). Waits on HT15 and HT16; Q21 at its default.
- **HS7.** `wonder_man/basic` (58022, 58024, 58034). Waits on HT17.
- **HS8.** Wonder Man starter deck e2e game, with Grim Reaper's set dealt in.

Hercules (`hercules/hercules/`):

- **HS9.** `identity` (59001a/b) and the shared `giftCardsYouControl` value (H3.9). Waits on HT1, HT2 and HT7.
- **HS10.** `gift-labor` (59002–59007). Waits on HT1 to HT6; question 3 and Q19 at their defaults.
- **HS11.** `events` (59009–59011). Waits on nothing but HS9's shared value.
- **HS12.** `support-upgrades-allies` (59008, 59012–59017). Waits on nothing but HS9's shared value.
- **HS13.** `obligation-nemesis` (59035–59040). Waits on nothing; Q22 at its default.
- **HS14.** `hercules/leadership` (59018–59020, 59023, 59024). Waits on HT8.
- **HS15.** `hercules/basic` (59025, 59026, 59028). Waits on HT9.
- **HS16.** `hercules/all-versus-all` (59041–59045). Waits on nothing.
- **HS17.** Hercules starter deck e2e game: all three Labor cards finished, all three Gift cards in play.
- **HS18.** A scenario game with All Versus All as a modular set, and one Hercules game where a Labor card finds no
  target.

HS1 to HS7 share no file; HS9 must land before HS10 to HS12 (they import its value); HS13 to HS16 share no file.
