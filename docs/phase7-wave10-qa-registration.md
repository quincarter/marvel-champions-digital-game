# Phase 7 wave 10 rules-QA pass, part 1: Civil War, the registration side

`rules-qa-engineer`, 2026-10-12, branch `feature/wave-10`. Scope: the leaders Iron Man (56059 to 56072) and Captain
Marvel (56092 to 56104), the registration main scheme (56063a to 56124b) and the eight registration modular sets (Mighty
Avengers, The Initiative, Maria Hill, Dangerous Recruits, Cape-Killer, Martial Law, Heroes for Hire, Paladin; 56073 to
56120). 115 ability refs. No script, existing test, engine, content or client file was changed.

Authorities, in order: the printed card (`packages/content/src/data/cw/cards.ts`, scan-checked in
`docs/phase7-wave10-scan-check-cw-registration.md`), MC56 (`docs/campaign-modes/mc56_rulebook-web_1.pdf`, p. 6 for the
cooperative reading, p. 20 FAQ), RRG 1.8 (`docs/rules/mc_rulesreference_v18_compressed.md`, page numbers below are the printed
ones), the FFG rulings (`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`), then the owner's answers (`docs/phase7-wave10.md`
§4.0 and §4.1). Tests: `packages/cards/src/wave10/qa-registration.qa.test.ts` (22 tests: 7 `it.fails` for the findings
below, 15 plain `it` for controls and pins) and `packages/cards/src/wave10/qa-games-registration.qa.test.ts` (12 greedy
games). Both pass; `oxlint`, `oxfmt --check` and `pnpm --filter @mc/cards typecheck` are clean.

## Findings

Four findings, all in the shipped scripts' observable behavior; none is a wrong printed number or a wrong target set.
The 115 scripts read correctly against the print; the findings are one reading of "Otherwise" (F1) and three places
where the engine's choice or ordering machinery does something the rules do not (F2 to F4).

| Id  | Card                                                                                     | Severity     | Test (in `qa-registration.qa.test.ts`)                       |
| --- | ---------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| F1  | 56107 Bring Them In                                                                      | wrong result | `56107 Bring Them In: the only Unregistered identity ...`    |
| F2  | 56072 Stark Tower, 56123b The Initiative, 56112 Colleen Wing (same shape: 56096b, 56113) | wrong prompt | one `it.fails` each, titles start `56072`, `56123b`, `56112` |
| F3  | 56069 Mark V Armor (with a tough status card on Iron Man)                                | wrong prompt | `56069 Mark V Armor: Iron Man holds a tough card and ...`    |
| F4  | 56079 Hellcat, 56117 Paladin (any Quickstrike minion with a When Revealed)               | wrong result | `56079 Hellcat: ...` and `56117 Paladin: ...`                |

### F1. 56107 Bring Them In: an already exhausted Unregistered identity is counted as "exhausted"

- Printed: "When Revealed: Exhaust each Unregistered identity. Otherwise, the enemy team searches the encounter deck and
  discard pile for a copy of Unregistered Super and deals it to you as a facedown encounter card."
- The game: with one Unregistered identity and that identity already exhausted, nothing happens (no copy is dealt). The
  script is `ifThen(exists(UNREGISTERED_IDENTITY), exhaust(...), dealUnregisteredSuperTo(you))`; the module header and a
  module test ("an Unregistered identity that is already exhausted still counts, so no Unregistered Super is dealt")
  state this as the intended reading.
- Expected: RRG "Otherwise" (p. 31): the "otherwise" sentence resolves when the preceding effect "cannot at least
  partially resolve". RRG "Exhaust" (p. 19): "An exhausted card cannot be exhausted again until it is ready." The RRG
  FAQ (p. 57, She-Hulk and Superhuman Strength) rules that an effect that cannot affect its only target cannot resolve
  (there the target is "already stunned"). So with every Unregistered identity exhausted, the first sentence cannot
  resolve and the copy of Unregistered Super is dealt. With one ready and one exhausted Unregistered identity the first
  sentence does resolve (partially), so the script is right there.
- Proof: `it.fails`: hero Unregistered by an Unregistered Super in play, identity exhausted, Bring Them In revealed:
  one Unregistered Super in play area where the print gives two. The control (a ready identity: exhausted, no copy
  dealt) passes.
- Owner: `ability-scripting-engineer` (the condition becomes "an Unregistered identity that is ready"); the module test
  that pins the old reading flips with it.

### F2. A forced enemy-team choice (one candidate) still asks the first player

- Printed: Stark Tower "The enemy team searches the encounter deck and discard pile for an Iron Man attachment and your
  team reveals it"; The Initiative "searches ... for 1[per_hero] side schemes and deals one to each player"; Colleen
  Wing "Choose an ally you control (the enemy team chooses instead if you have the Unregistered trait)".
- The game: with exactly one candidate the first player gets a prompt with authority `enemyTeam` and one option
  (`chooseCards` with 1 option for Stark Tower and The Initiative, `chooseTarget` with 1 option for Colleen Wing).
- Expected: RRG "Search" (p. 39): "If a player finds multiple cards that satisfy the criteria of a search, the player
  chooses among those options"; with one there is nothing to choose. `docs/phase7-wave10.md` §3.5 says the same ("Where
  there is one candidate there is no prompt"). Nothing is being decided, so the prompt is a dead click. It works for
  "a copy of" searches (Energy Channel, Life Model Decoy, Unregistered Super: `oneCopyOf`), not for the others.
- Not caught by the module tests: the Stark Tower test "with a single candidate left there is no prompt" settles every
  prompt with `firstLegal` and then asserts `pendingChoice` is null, which it is whether or not a prompt was shown.
- Proof: three `it.fails`, each with a picker that records the prompts. S.H.I.E.L.D. Recruits (56096b) runs the same
  `searchAndDealOnePerPlayer` code and Shang-Chi (56113) the same `chooseTarget` shape as Colleen Wing; neither was
  staged (Recruits' prompt is already pending when `createGame` returns, so its candidates cannot be pruned first).
- Owner: `game-rules-architect` (a forced `enemyTeam` chooser, or any chooser with one option and a minimum of one,
  resolves without a prompt). Severity "wrong prompt": the outcome is the same.

### F3. 56069 Mark V Armor and a tough status card: no order is offered

- Printed: "Forced Interrupt: When Iron Man would take any amount of damage, place it here instead. Then, if there is at
  least 5 damage here, discard this card." Iron Man also gets a tough status card from Mark V Helmet and Arc Reactor.
- RRG "Tough" (p. 44): a tough status card "resolves like the triggered ability: Forced Interrupt: When this character
  would take damage, remove a tough status card from it instead." RRG "Forced" (p. 20): "If two or more forced abilities
  would initiate at the same moment, the first player determines the order." So a hero's attack on a tough Iron Man
  with the Armor attached starts two forced interrupts on one damage, and the first player (the enemy team's choice
  under the grim rule, MC56 p. 6) orders them: Armor first keeps the tough card and puts the damage on the Armor; tough
  first discards the tough card and leaves the Armor empty.
- The game: no ordering prompt; the tough card always resolves first (tough 1 to 0, nothing on the Armor, Iron Man
  undamaged). Pinned by a passing test.
- Proof: `it.fails` expects an `orderTriggers` prompt during the attack.
- **Retired (issue #525, item 5):** RRG 1.8 "Simultaneous Timing Priority" (p. 5, revised in v1.8) resolves status-card
  Forced Interrupts (2a) before other Forced Interrupts (2b), and "Damage" (p. 14) takes tough status cards (step 2)
  before "would take any amount of damage" abilities (step 3). "Forced" (p. 20) orders only abilities of equal priority,
  so the game's order is right; the `it.fails` is removed and the pinning test kept.
- Owner: `game-rules-architect` (status cards as forced interrupts for ordering). This may be a deliberate engine
  choice (tough as a prevention, not a trigger); then the RRG sentence "resolves like" is what to decide on. Severity
  "wrong prompt" (the choice is missing, the engine has picked the order that is worse for the enemy).

### F4. Quickstrike resolves before the minion's When Revealed

- Printed: Hellcat "Quickstrike. When Revealed: You are stunned. If you were already stunned, take 2 indirect damage."
  Paladin "Quickstrike. Toughness. When Revealed: Discard 1 card from your hand".
- RRG "Quickstrike" (p. 36): "If a minion with the quickstrike keyword is being revealed, the quickstrike keyword
  resolves after any When Revealed abilities on that minion are resolved." (Teamwork says the same, RRG p. 43, and the
  engine gets that one right: Wasp's threat is placed before her Teamwork attack.)
- The game: the Quickstrike attack resolves first (event index 71), then the When Revealed (86 for Hellcat; 72 and 87
  for Paladin). The module test of The Initiative is titled "Quickstrike attacks first" and treats it as intended.
- Consequence: Paladin's discard happens after the attack, so a card in that hand can be played into the attack's
  windows (a Hero Interrupt, a defender-side event) that the print would already have taken from the hand (at random if
  Unregistered). Hellcat has no visible difference today (her stun does not change what her attack does), but the order
  of the log is wrong.
- Proof: two `it.fails` comparing the index of `abilityResolved` for the When Revealed with the `attackResolved`.
- Owner: `game-rules-architect` (the reveal pipeline: Quickstrike is a Forced Response "after this minion engages a
  player", and RRG says that on a reveal it waits for the When Revealed). Affects every Quickstrike minion with a When
  Revealed, in any pack.

## The five known items

1. **Paladin's Pistol 56118, the "ranged" half.** Tested: with the Pistol on Paladin the attack's damage event carries
   `ranged` (a Paladin attack on a hero, the Pistol attached by `attachToHost`); without it, `ranged` is false.
   Correct. ("Ranged" only matters against a Retaliate defender: RRG "Ranged", p. 36; the flag is what the engine
   reads.) The overkill half was already covered by the module's tests.
2. **A one-candidate enemy-team choice still prompts.** Wrong; see F2. RRG "Search" (p. 39) asks for a choice only
   among several finds, and §3.5 of the spec says none for one candidate.
3. **Yellowjacket minion 56073 against the ally 56019.** The module is right that they never match. The engine's
   `cardsMatch` is the RRG predicate (RRG "Unique Icon", pp. 45 and 46): two cards match when they share a title and
   both have no subtitle and no alter-ego title, or when the subtitle or alter-ego title of one equals the title,
   subtitle or alter-ego title of the other. The minion has no subtitle; the ally's subtitle is "Hank Pym". The first
   bullet fails (the ally is not bare) and the second fails ("Hank Pym" is not "Yellowjacket", and the minion has no
   secondary name). Both titles are "Yellowjacket" after the RRG's erratum (p. 70). A pool scan of `PLAYABLE_CARDS` and
   the Civil War cards found two matches the spec does not list, both correct under the rule: the minion matches the
   Ant-Man nemesis minion Yellowjacket 12027 (also bare), and the ally matches the Ant-Man ally 12011 (subtitle "Hank
   Pym"). Tests: `56073 Yellowjacket (minion) against the ally 56019 ...` (two, passing).
4. **Cosmic Flight 56100 with two copies (owner question 29, open).** Pinned, not judged: both copies trigger on the
   same 5 damage, the damage is capped at 3 once, and both copies are discarded (A, built). Test:
   `pin: two copies on the same 5 damage ...` (passing; flip it if the owner picks B).
5. **Energy Channel 56098 with an ally that dies to its own consequential damage.** The module is right and the spec
   (§3.20, last test line) is wrong. RRG "Consequential Damage" (p. 13): "Consequential damage is dealt to an
   ally after
   resolving abilities that are triggered by the ally attacking or thwarting." RRG "Attack (Player Ability Type)"
   (p. 10, the order of resolution): forced "after attacks" abilities (7), non-forced (8), then consequential damage
   (9). FAQ (p. 58): Tigra's "After Tigra attacks and defeats a minion" is checked "before consequential damage is
   applied". So the ally (Moon Knight, 1 hit point left, consequential damage 1) is still in play when Energy Channel
   resolves at 4 counters: she attacks it, defeats it, and the Forced Response of the leader places 1 counter. Test:
   `an ally that would die to its own consequential damage is still in play when the response resolves ...` (passing).
   Two more Energy Channel checks pass: an attack event (Uppercut) is an attack (RRG p. 10), and a stunned hero's basic
   attack places no counter (RRG "Stun", p. 41; ruling Aug 13, 2026 R1).

## Play tests

`qa-games-registration.qa.test.ts`: seeded greedy games (`packages/cards/src/testing/driver.ts`, which knows no card
names) with the Tigra and Hulkling starter decks (the Core Spider-Man deck as a third seat), each through
`registration-iron-man` and `registration-captain-marvel` with the ready-made main scheme pairs: 1 player standard
(seeds 1 and 3), 1 player expert (5), 2 players expert (2), 2 players standard (4), 3 players standard (5). 12 games,
each to an outcome (a command cap of 3000), each replayed from its log to a deep-equal final state.

| Scenario       | Table               | Outcome (round, commands)            |
| -------------- | ------------------- | ------------------------------------ |
| Iron Man       | 1p standard, seed 1 | loss, all players defeated (2, 16)   |
| Iron Man       | 1p standard, seed 3 | loss, main scheme completed (5, 53)  |
| Iron Man       | 1p expert, seed 5   | loss, all players defeated (3, 29)   |
| Iron Man       | 2p expert, seed 2   | loss, main scheme completed (5, 102) |
| Iron Man       | 2p standard, seed 4 | loss, all players defeated (3, 53)   |
| Iron Man       | 3p standard, seed 5 | loss, main scheme completed (6, 186) |
| Captain Marvel | 1p standard, seed 1 | loss, all players defeated (6, 78)   |
| Captain Marvel | 1p standard, seed 3 | loss, all players defeated (3, 28)   |
| Captain Marvel | 1p expert, seed 5   | loss, all players defeated (2, 19)   |
| Captain Marvel | 2p expert, seed 2   | loss, main scheme completed (5, 86)  |
| Captain Marvel | 2p standard, seed 4 | loss, main scheme completed (9, 157) |
| Captain Marvel | 3p standard, seed 5 | loss, all players defeated (7, 201)  |

No stall, no refused command, no unanswerable prompt, no prompt left open after an outcome, no replay difference. The
greedy driver never wins (it does not thwart enough), so the winning paths (a leader defeated at stage II or IV, the
victory display, a main scheme won) were not reached; they are covered by the module tests only. One game was traced by
hand to check the arithmetic (Iron Man 1p standard, seed 1: stage II ATK 2 with Rocket Boots and Powered Gauntlets = 4;
boosts 2 and 3, the 3 being the 56077 side scheme's amplify icon on a 2-icon boost card; 6 and 7 damage): consistent.
The brief says Hunted 56007 and Alien Physiology 56036 were still being finished in the engine; no game was refused on
account of either (whether they were drawn was not traced).

## Checked and correct

Every ref was read side by side with the print (data text, with the scan-check's corrections: 56061 "Setup", 56069
"Forced Interrupt", 56098 and 56073 errata). A script on this list has the right target set, "may" or compulsory,
"each" or "a", timing, limit, per-player icon, "then" order and no-valid-target behavior; an "In competitive mode"
clause is written in full as a marker and the cooperative branch matches MC56 p. 6. Refs with a finding are marked.

- **Iron Man leader, 27 refs.**
  - 56059 to 56062 `iron-man-constant` (+1 SCH per Tech attachment on him, capped at +3; counts any set's Tech
    attachment, a Life Model Decoy included: tested).
  - 56059.setup and 56061.setup (deck only; first player decides in a marked prompt; the first player reveals; shuffle
    after; stage III prints Setup, scan-checked).
  - 56060.when-revealed and 56062.when-revealed (each player dealt a card; no damage to him this phase).
  - 56065 constant, response and boost (ranged; Hero Response energy + physical after a basic attack by you; boost
    reveals it); 56066 the same with the Aerial trait.
  - 56067 and 56068 constant, constant-2, response (tough card on attach, stalwart / retaliate 1, mental + physical).
  - 56069 `forced-interrupt` (Interrupt, not Response; 5-damage check after placement): **F3**; boost correct.
  - 56070 both forms (alter-ego: discard an upgrade or support you control; hero: top 4, one damage instance per RRG
    "for each" p. 20, energy and wild icons).
  - 56071 both forms (Tech read when the sentence resolves; piercing).
  - 56072.when-defeated (deck and discard pile; the defeating player reveals): **F2**.
- **Captain Marvel leader, 21 refs.**
  - 56092 and 56094 setup (one Energy Channel, no prompt, shuffle).
  - 56092 to 56095 forced-response (once per character defeated: Jan 11, 2026 R1; "defeats a character" includes an
    identity).
  - 56093 and 56095 when-revealed.
  - 56098 forced-response (as the RRG p. 70 erratum; counter on every attack by a hero or ally, event attacks included;
    stunned attacker places none; overkill; consequential damage after: the known item 5).
  - 56099 constant, response (3 resources of one type) and boost; unique against the Core upgrade 01016.
  - 56100 forced-interrupt (more than 3 only; exactly 3 untouched) and boost; two copies pinned.
  - 56101 to 56103 both forms and boosts; 56104 when-defeated.
- **Registration main scheme, 18 refs.**
  - Four 1A setups: the side scheme found, shuffle, competitive sentence written in full.
  - 56063b hinder (only with more than 1 player) and Cut Off Support (limit once per phase per player).
  - 56064b Negative Zone Prison (target lowered per facedown card, ally defeated by an enemy attack goes under it).
  - 56096b hinder and when-revealed (**F2** shape for one candidate, not staged).
  - 56097b Hunting Rebel Heroes (constant, forced response; owner question 12 = A, not judged).
  - 56121b Homeland Security; 56122b Public Outrage (after step 1, each player discards the top 3).
  - 56123b when-revealed (**F2**); 56124b No Going Back.
- **Mighty Avengers, 8 refs.**
  - 56073 (tough card for the enemy leader, as When Revealed and as Boost), 56074 Wasp (threat on the main scheme),
    56075 U.S. Agent.
  - 56076 "Resolve the When Revealed of each minion in play" with surge when none resolved.
  - 56077 Earth's Mightiest Heroes. Keywords gained as a minion enters play act: a Wasp in play gives a revealed U.S.
    Agent Teamwork and he activates (tested, RRG p. 43).
- **The Initiative, 8 refs.** 56078 Doc Samson and 56079 Hellcat (the status read before it is given; **F4** for
  Hellcat's order); 56080 Drafted (cooperative branch; no minion anywhere: terminates, Drafted discarded; tested);
  56081; 56082.
- **Maria Hill, 7 refs.** 56083 (one copy, no prompt, limit 1); 56084 (host chosen by the first player in a marked
  prompt, stalwart, prevent and discard); 56085 (surge and 3 boost icons with Maria Hill in play); 56086 (the defeating
  player).
- **Dangerous Recruits, 7 refs.** 56087 (piercing; cooperative branch: activates against you); 56088; 56089 (shared with
  56187); 56090 (When Revealed; the boost clause is competitive only and written in full); 56091.
- **Cape-Killer, 5 refs.** 56105 (+2 ATK against an Unregistered identity); 56106 (trait, Alter-Ego Action with an
  identity-specific discard); 56107 (**F1**); 56108.
- **Martial Law, 4 refs.** 56109 (topmost S.H.I.E.L.D. minion; boost puts it into play); 56110 (printed values); 56111.
- **Heroes for Hire, 6 refs.** 56112 (**F2**) and 56113 (**F2** shape, not staged); 56114 (shared with 56106); 56115
  (shared with 56119); 56116.
- **Paladin, 4 refs.** 56117 (**F4**); 56118 (+2 ATK is data; ranged and overkill, discarded after the attack); 56119; 56120.

In sum: 106 refs checked and correct, 9 with a finding (56069, 56072, 56079, 56096b, 56107, 56112, 56113, 56117,
56123b), two of them (56096b, 56113) by shape and not staged.

## Unproven

- **S.H.I.E.L.D. Recruits 56096b and Shang-Chi 56113, one candidate.** Same code path as the F2 cards. Recruits cannot
  be staged because the prompt is pending as `createGame` returns; Shang-Chi was not written.
- **Mark V Armor against a Life Model Decoy** on Iron Man (two forced interrupts on one attack): the same class as F3,
  not tested.
- **Executive Order 56085, "If Maria Hill is in play".** Whether the Maria Hill ally (01067, 50036) counts is not
  tested; the print does not say "minion".
- **Energy Channel when the attacker has left play** (Jan 26, 2026 R5; Jun 2, 2026 R4): staged only through the
  consequential damage case; a card that removes the attacker between the attack and the response was not found in the
  pool.
- **A stunned Paladin keeps his Pistol** ("not considered to have attacked", RRG p. 41); not tested.
- **Public Outrage with a deck of fewer than 3 cards**: not tested.
- **Hunting Rebel Heroes (question 12 = A)** and **Cosmic Flight (question 29)**: owner decisions, pinned or not
  judged.
- **Winning games.** None of the 12 greedy games wins, so the leader's defeat path through the whole box is only covered
  by module tests.

## Spec corrections owed

`docs/phase7-wave10.md` (the main session owns the status and open questions; these are reports):

1. **§3.20, last test line** ("Three counters, an ally attacks and dies to its own consequential damage: 0 counters, no
   attack, no boost card") is wrong: RRG p. 13, p. 10 step 9 and the FAQ on p. 58 put consequential damage after the
   response. The module and its tests are right; the spec text should say Captain Marvel attacks the ally.
2. **§3.8, the table row "Wasp, Falcon, Venom, ..., Yellowjacket: nothing"** and §3.22's Yellowjacket bullet: the
   minion 56073 matches the Ant-Man nemesis minion 12027 under the RRG predicate, and the ally 56019 matches the Ant-Man
   ally 12011 (same subtitle). Not a script problem; two pairs the unique rule will refuse.
3. **§3.5, "Where there is one candidate there is no prompt"** is true of the "a copy of" cases only. Either the engine
   builds the rule for every forced chooser (F2) or §3.5 and the Stark Tower / Recruits tests it prescribes say that a
   prompt with one option is shown.
4. **Bring Them In (§3.5, §3.16)** states no
   reading of "Otherwise" for an already exhausted Unregistered identity; the
   module chose "counts"; RRG p. 31, p. 19 and the FAQ on p. 57 point to "does not count" (F1). The spec should record
   the owner's choice either way.
5. **Quickstrike with a When Revealed** (Hellcat 56079, Paladin 56117): the spec lists neither; RRG p. 36 orders the
   When Revealed first (F4). The Initiative module's test title "Quickstrike attacks first" documents the engine's
   order as intended and flips with the fix.
