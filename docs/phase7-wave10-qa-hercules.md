# Phase 7 wave 10 rules-QA pass, part 4: the Hercules hero pack

`rules-qa-engineer`, 2026-10-12, branch `feature/wave-10`. Scope: every ability scripted in
`packages/cards/src/wave10/hercules/` (`hercules/identity.ts`, `hercules/gift-labor.ts`, `hercules/events.ts`,
`hercules/support-upgrades-allies.ts`, `hercules/obligation-nemesis.ts`, `leadership.ts`, `basic.ts`,
`all-versus-all.ts`): **59 ability refs**, 6 of them aliases of an earlier card's script (59021, 59022, 59027 x2, 59033,
59034). Not audited: 59025 Gilgamesh and 59032 Avengers Compound (still in a SKIPPED map), and the heal amount of 59017
Prince of Power (owner answer 31B, being changed by another agent; its timing and form restriction are audited). No
script, existing test, engine, content or client file was changed.

Authorities, in order: the printed card (`packages/content/src/data/hercules/cards.ts`, scan-checked in
`docs/phase7-wave10-scan-check.md`; the 59001b scan was re-read for the alter ego's traits), RRG 1.8
(`docs/rules/mc_rulesreference_v18_compressed.md`; printed page numbers below), the FFG rulings
(`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`: February 8, February 20, March 6 and June 2, 2026 name these cards), the
owner's answers (`docs/phase7-wave10.md` section 4.0: 3B, 19A, 22A, 30B, 31B), then the spec
(`docs/phase7-wave10-hero-packs.md`). The file under test:
`packages/cards/src/wave10/qa-hercules.qa.test.ts`: 48 tests, **46 pass, 2 `it.fails`** (one per finding), `oxlint` and
`oxfmt --check` clean, typechecks clean. It holds pins of behavior the module tests do not cover beyond one-card
isolation, a scripted full game and the two findings.

## Findings

Two findings, both low. The 59 scripts read correctly against the print in target set, "may" or compulsory, timing
word, form restriction, cost against effect, limit and "you" against any player, except where noted. The module tests
are thorough (every card has a play-through); what they could not see is below.

| Id  | Card                   | Severity                                           | Test (in `qa-hercules.qa.test.ts`)                                     |
| --- | ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| F1  | 59004 Protect Humanity | wrong result, low (unreachable with prints), fixed | `it` (was `it.fails`) "... with Amadeus Cho removed from the game ..." |
| F2  | 59028 Evaluate Threat  | wrong result, low (a shuffle only), fixed          | `it` (was `it.fails`) "... a player who declines the search ..."       |

### F1. Protect Humanity stays in play when Amadeus Cho cannot be found

**Status: fixed.** The script now discards the card when no Amadeus Cho is in play after the find; the pin is a passing
`it` and `gift-labor.test.ts` has a module test. The text below is the finding as audited.

- Printed: "When Revealed: Find Amadeus Cho and put him into play." RRG 1.8 FAQ p. 65 ("Hercules Hero Pack: Labor
  Cards"): "What happens if a Labor card fails to find a target when it is revealed? That Labor card is discarded. Any
  time a Labor card leaves play other than being placed in the victory display, place it on the bottom of the Labor
  deck." March 6, 2026 - Ruling 3 (2): "If a Labor card cannot enter play, place it on the bottom of the Labor deck."
  Owner answer 3B: the card is discarded (announced) and ends on the bottom.
- The game: Defeat the Hydra (module test) and Embody Pathos (pinned here, passing) with no target are discarded and go
  to the bottom of the Labor deck (`revealedCardDiscarded`). Protect Humanity with Cho removed from the game (nowhere a
  find looks) is revealed as an obligation, **stays in Hercules's play area** with its counters, and the Labor deck
  holds two cards. Its script's `findCard` has no `choose`/failure branch the other two Labor cards use.
- Expected: discarded, bottom of the Labor deck (`["59002","59003","59004"]`), not in play, so New Labors can be used
  again.
- Reach: Cho is findable in the deck, hand (pinned, passing: no shuffle), discard and play (module tests), and no
  printed card removes him from the game, so this needs a state no printed card makes. That is why it is "low".
- Owner: `game-rules-architect` (the engine's Labor-target failure) or `ability-scripting-engineer`.

### F2. Evaluate Threat shuffles the deck of a player who declines to search

**Status: fixed.** The script now asks each player "search or not" (`chooseOneBy`); only a player who searches takes
one card (`min: 1`, as Air Cover) and has the deck shuffled. The pin is a passing `it` and `basic.test.ts` has module
tests. The text below is the finding as audited.

- Printed: "When Defeated: Each player **may** search their deck and discard pile for an Avenger or S.H.I.E.L.D. card and
  add it to their hand. (Shuffle.) ..."
- The game: the choice is `chooseCards(..., min: 0, max: 1)` then `shuffleDeck(thatPlayer)` for every player. A player
  who takes no card although Avenger cards are there (so declined to search) still has the deck shuffled; with a card
  taken the one shuffle is right (pinned, passing).
- Expected: RRG "Search" (p. 39): "If any portion of a deck is searched ... shuffle that entire deck". A player who
  does not search shuffles nothing. Once a player searches and a card matches, the card is added (the Air Cover finding of
  `docs/phase7-wave10-qa-players.md` F2 is the compulsory half of the same pair), so "takes none while candidates exist"
  means "did not search".
- Reach: the shuffle only matters if a player knows the top of their deck (a look at it, Redwing-style effects), so it is
  low. Every other "may search" script in the repo has the same shape; this is the first audited that has both "may" and
  a printed "(Shuffle.)".
- Owner: `ability-scripting-engineer` (a yes/no "search?" before the card choice; shuffle only on yes).

## Owner question

**Q1. 59041 All Versus All answers the defeat that brings it into play.** Hecate's "When Defeated: find All Versus All and
reveal it" puts the scheme in play during her defeat (a When Defeated is a Forced Interrupt, RRG p. 48). All Versus All's
"Forced Response: After a character is defeated, place 2 threat on this scheme" is then heard in the response window of
that same defeat.
**A (built until 2026-10-12):** it is in play when the window opens, so it answers: 2 + Hinder 2 + 2 = 6.
**B:** a card that was not in play when the triggering condition occurred cannot respond to it: 4.
No ruling speaks to it ("Mister Knife" in the Feb 2026 rulings is a constant, not a response window).
**Answered B and built (owner answer 43B, 2026-10-12, `docs/phase7-wave10.md` §4.0).** The rule is the engine's, for
every card and every response window: a card that enters play after a triggering condition has occurred is listed on
that condition (`TriggerEvent.enteredPlaySince`, `packages/engine/src/entered-since.ts`; RRG 1.8 "Triggering
Condition", p. 45, "Response", p. 38) and is not gathered for its Response or Forced Response window. All Versus All
enters play with 4 here and answers the next defeat (the module tests and the pin in `qa-hercules.qa.test.ts` now read
4, and a second pin reads 6 after the next defeat).

## Per-ability verdicts

OK = read against the print, the RRG and the rulings, with the module's tests plus this pass's pins. Refs marked
"pin" have a test in `qa-hercules.qa.test.ts` beyond the module tests.

### hercules/identity (3)

- 59001a.atonement: OK. Hero Response, hero face only, once per phase, the flip is its own (not the round's); the gift
  deck empty still readies and flips. Pin: the victory-display window opens first and offers only Atonement; flipping in
  it forfeits Prince of Power (a Hero Response) for that defeat. A reading of "Triggering Condition" (p. 45), noted below.
- 59001b.hercules-constant: OK (data: both decks built at setup, owned by the Hercules player).
- 59001b.new-labors-of-hercules: OK. Alter-ego face only, refused while a Labor card is in play or the deck is empty.
  Pins: a no-target Embody Pathos is discarded to the bottom; Cho found in the hand puts him into play with no shuffle,
  in the deck with one shuffle (RRG "Find" p. 19, "Search" p. 39). **F1** for Protect Humanity.

### hercules/gift-labor (13)

- 59002.defeat-the-hydra-constant: OK. Pin: the attached minion takes nothing from Retaliate (Shield of Perseus), which
  is not an attack (RRG "Retaliate X" p. 38); only Hercules's attacks hurt it.
- 59002.when-revealed: OK. Pin: a minion already in play (Tweedledope, 6 hit points) engages Hercules and **re-resolves
  its When Revealed** (RRG "Find" p. 19): he is stunned.
- 59003.embody-pathos-constant: OK. Pins: Wisdom of Athena (Hercules's thwart, not a basic one) removes its full 4 under
  assault (p. 8); Teamwork with Deathcry is still Hercules's thwart and adds the ally's ATK (assault, last bullet): 12 to 6.
- 59003.when-revealed: OK (per-player icons read as 1 for the reveal only, owner 19A; set-aside schemes found, June 2,
  2026 Ruling 2 (3)).
- 59004.obligation: OK (engine rule). 59004.when-revealed: **F1**. 59004.protect-humanity-forced-interrupt: OK. Pin: Herc's
  Helm (defense label) redirected to Cho makes Hercules "defended", so the labor counter goes 3 to 2 (p. 15).
- 59005.nemean-lion-skin-constant: OK. Pin: steady with one stunned card leaves him unstunned (p. 41). 59005, 59006,
  59007 responses (draw 4, optional): OK. 59006 constant: OK (Retaliate vs a ranged attack is pinned under 59044).
  59007 constant: OK. Pin: Permanent Sword is never offered when a third Restricted card forces a discard (RRG
  "Restricted" p. 38, "Permanent" p. 32).

### hercules/events (5)

- 59009 constant and action: OK. Pin: a stunned Hercules playing it is stopped by the stunned card, the event is spent
  (RRG "Stun" p. 41).
- 59010: OK. Pin: with all Gifts ready the "ready an upgrade" bullet has nothing to do and the tough card and the draw
  still resolve (the bullets are independent).
- 59011 constant and action: OK. Pins: a confused Hercules removes the confused card instead; with no scheme at 0 threat
  anywhere it cannot be played, with 1 threat it can (RRG "Target" p. 42, "Cost" pp. 13 to 14); Roving Mobs's crisis icon
  leaves only the side scheme to target (p. 14).

### hercules/support-upgrades-allies (8)

- 59008 forced interrupt and action: OK (module: attacks on another player and on Cho are not redirected).
- 59012 resource: OK.
- 59013: OK. Pin: offered after Herc's Helm made Hercules the defender (RRG "Defend, Defense" p. 15: "abilities that
  trigger when your hero defends ... can be triggered when resolving a defense-labeled ability").
- 59014: OK. Pin: a stunned Hercules is not "making a basic attack", the Mace is not offered and stays ready.
- 59015: OK. Reads "When the villain attacks" without "you": offered for an attack on another player, where it makes
  Hercules the defender and the target (pin; RRG p. 8 "if a player other than the target player defends ...").
- 59016: OK. 59017: timing and form restriction OK (hero form, "after Hercules attacks and defeats"); heal amount
  not audited.

### hercules/obligation-nemesis (7)

- 59035 constant and action: OK (the Gift count is read by `giftCardsYouControl`; pinned in the scripted game: Appeal
  in play makes The Gift of Battle cost its full 3, paying its action by exhausting removes it from the game and the
  cost is 2 again).
- 59036: OK. 59037: OK (owner 22A, an attack that defeats the Hydra asks nothing, module test).
- 59038: OK (Olympic Feud counts every Olympus card in play, Hercules himself included).
- 59039: OK. **Stale comment:** the header says the Axe is discarded when "all defended and prevented, or the attack
  stunned". A stunned attacker "is not considered to have attacked" (RRG "Stun" p. 41), so the Forced Response is not
  triggered and the Axe stays; the module test ("a stunned Rhino does not attack, so the response is not triggered")
  and the engine are right, the comment is wrong. Documentation only.
- 59040: OK. Pin: the minion found by "discard until a minion" and revealed is resolved When Revealed first, then
  Quickstrike (owner 30B, RRG "Quickstrike" p. 36): Hellcat stuns Hercules, then attacks.

### leadership (8)

- 59018: OK. Pin: "deal your hero 1 damage" is a cost that is paid even if the damage is prevented (RRG "Cost" p. 14):
  a tough status card is spent, Hercules takes none, Deathcry takes 1 consequential damage instead of 2.
- 59019: OK. 59020: OK.
- 59021 (alias of 06032), 59022 (alias of 40018): OK, pinned by a text comparison with the source's text.
- 59023 constant and action: OK ("[type] form only" is a play restriction, RRG "Form" p. 21).
- 59024: OK. Pin: attached to another player's ally it is controlled by that player (RRG "Ownership and Control" p. 31),
  who is offered the Interrupt and draws the 2 cards.

### basic (7; 59025 and 59032 skipped)

- 59026: OK. 59027 constant and action (alias of 31023): OK (text pinned; Hercules has exactly 14 printed hit points).
- 59028 constant: OK. Pin: Hercules's alter ego prints only Olympus (scan 59001b), so "Play only if your identity has the
  Avenger ..." cards are refused in alter-ego form and offered in hero form. This follows RRG "Form" (p. 21); it is a
  player-facing consequence (Evaluate Threat, Quincarrier, "Avenge Me!" are hero-form cards for him), not a defect.
- 59028 when defeated: **F2**.
- 59033 (alias of 01092), 59034 (alias of 08023): OK, text pinned.

### all-versus-all (8)

- 59041 forced response and when defeated: OK; **Q1** (answered B, built) for the timing with Hecate.
- 59042 when revealed / when defeated / forced response: OK.
- 59043: OK. 59044: OK. Pin: its attacks are ranged, which ignores Retaliate (RRG "Ranged" p. 36): Shield of Perseus hurts
  Rhino and not the Officer, whose ATK 3 lands in full.
- 59045: OK.

In sum: 57 refs checked and correct, 2 refs with a finding (59004.when-revealed, 59028.when-defeated), 1 stale script
comment (59039), 1 owner question (59041 with 59042).

## The scripted game

`describe("Hercules ... a scripted game")`, one player, `herculesGame()` (the hand-built `HERCULES_DECK`) against Core's
Rhino, standard, seed 1, four rounds of real commands through `sessionApply`, one decision at a time. Only the cards a
round needs, the Labor order, the Gift order and the encounter cards of a villain phase are placed by surgery; each
surgery closes a logged segment. After every command and every answered prompt the invariants hold: no prompt that
cannot be answered, no soft lock, no card in two zones, every card Hercules owns in some zone, each of the six Labor
and Gift cards exists once and is owned by him, at most one Labor card in play, the Gift cards add up to 3, no
negative damage, one voluntary form change per round; each segment replays deep-equal from its own log.

- R1: New Labors reveals Defeat the Hydra and finds the Lernean Hydra (12 hit points); he flips to hero form; Gauntlets
  attached; the Hydra at the brink is defeated by a basic attack; the Labor card is in the victory display, Atonement
  puts Nemean Lion Skin into play (draw 4), the flip is declined; undefended in the villain phase (he readied at the end
  of the player phase, RRG "End of Player Phase" p. 18).
- R2: Olympus pays for Golden Mace (one Gift, one wild resource); Wisdom of Athena costs 3 - 1; Appeal to Athena is
  revealed in the villain phase and The Gift of Battle's cost goes from 2 to 3.
- R3: he flips to alter ego, pays Appeal's action by exhausting (it leaves the game; the cost is 2 again); New Labors
  brings Protect Humanity and Cho; Rhino schemes against the alter ego and nothing is redirected.
- R4: hero form; basic attack with the Mace deals 4; Rhino's attack is redirected to Cho, Hercules defends it, one labor
  counter is removed.

Not won (four rounds against a 14-hit-point villain). Not exercised in the game (covered by pins and module tests):
Embody Pathos, Namora, Thor, Deathcry, All Versus All.

## Checked beyond the module tests (the pins)

Atonement against Prince of Power (windows); Embody Pathos with no scheme to find; Cho found in hand and deck;
Retaliate against the Labor minion; an in-play minion's When Revealed re-resolved by Defeat the Hydra; Wisdom of Athena
and Teamwork under assault; Helm with Protect Humanity; Restricted with the Permanent Sword; steady against a stunned
card; stunned and confused events; Wisdom with no threat and with a crisis scheme; Son of Zeus with every Gift ready;
Helm with Gauntlets and for another player's attack; Mace and Deathcry under a stunned card and a tough card; "Avenge
Me!" on another player's ally; the Avenger trait by form; the reprints' text; God of War with Quickstrike; ranged
against Retaliate. The two engine-wide rules that changed this week are covered: no threat, no thwart target (Wisdom
of Athena; also Wisdom's crisis case) and the reveal order (God of War revealing Hellcat); both pass today.

## Unproven

- **The two windows of Atonement and Prince of Power** (pin 1) is a reading of "Triggering Condition" (p. 45); if the
  owner reads the victory display placement and "attacks and defeats" as one occurrence, both would be offered in one
  window and a player could heal, then flip. Not asked as a question because nothing in the print or the rulings points
  to it.
- **Defeat the Hydra's reveal of a Quickstrike minion** (Scorpion, 7 hit points, Core) was not staged: the minion's attack
  would come before the Labor card attaches under 30B; no ruling covers the order, so not judged.
- **Two players with both Hercules and another separate-deck hero** (Wonder Man): not staged; the separate decks are keyed by
  owner and the invariants above would catch a mix-up, but the game is one-player.
- **Multi-player Atonement, Gift counts and Appeal to Athena** are covered by the module tests (two players), not by the
  scripted game.
- **The heal amount of Prince of Power** (31B) and the two skipped refs.
- **Engine work in progress.** The tree had uncommitted engine, DSL, `hercules/basic.ts` and Prince of Power changes while
  this pass ran; the file passes against that tree. A later failure of the Prince of Power window pin or of the Teamwork
  pin would come from that work, not from these cards.
