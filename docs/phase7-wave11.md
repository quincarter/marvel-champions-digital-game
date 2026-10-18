# Phase 7 working spec: wave 11 (cycle 11, Fear No Evil)

This is the shared brief for every agent working Phase 7's eleventh content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). The model is `docs/phase7-wave10.md` and its section numbers are kept (§0 sources, §1 schema,
§2 setup, §3 primitives, §4 rulings and questions, §5 other agents, §6 later passes, §7 card tables, §8 build order).
Wave 1–10 §3 primitives are assumed. The definition of done is `docs/wave-definition-of-done.md`; its step 6 (the box's
campaign) applies to the whole wave but not to this pass (§6.1). If you change a decision here, update this file in
the same change. Agents do not edit statuses or open questions; they report, and the main session flips them.

**Wave 11** is our `cycleId("cycle11")`: Fear No Evil (`fne`, MC60, campaign expansion), Jessica Jones (`jj`, MC61) and
Luke Cage (`luke_cage`, MC62). RRG 1.8 Appendix VI (p. 71) lists waves 1 to 10 only; the order is release order
(`docs/phase7-wave11-sources.md` §1). The spec is written in passes:

| Pass   | Scope                                                                                                                 | State       |
| ------ | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| **1a** | **Fear No Evil's player half: Daredevil, Echo, their nemesis sets and obligations, the box's aspect and basic cards** | **written** |
| 1b     | Fear No Evil's scenarios and campaign (no card data exists yet, §6.1)                                                 | blocked     |
| 2      | Jessica Jones (`jj`), Luke Cage (`luke_cage`) (§6.2, §6.3)                                                            | not written |

- **Pass 1a's content.** 66 raw records, all in `packages/content/raw/marvelcdb/fne.json` (pointer:
  `docs/cards/by_pack/fne.md`): identities 60001a/b and 60037a/b, the Sense deck 60002–60006, the two hero kits
  (60007–60018, 60039–60047), the obligations 60032 and 60060, the nemesis sets 60033–60036 and 60061–60064, and the box's
  aspect and basic cards 60019–60031, 60038, 60048–60059.
- **Data state (2026-10-18, branch `feature/wave-11`):** `fne` is raw cache only; nothing of this wave is emitted or
  scripted. `docs/phase7-wave11-data-survey.md` (what the normalizer does with `fne`) and
  `docs/phase7-wave11-sources.md` (where every source lives) were written before this pass.

## 0. Sources

- **RRG 1.8**, `mc_rulesreference_v18_compressed.md` (pages from the footer markers): Acceleration Icon p. 5, Amplify
  Icon p. 7, Attach To p. 8, Copy and Cost p. 13, Dash (Value) p. 15, Event p. 18, Find p. 19, Identity p. 23,
  "Cannot" p. 11, Interrupt p. 25, Labeled Ability p. 26, Leaves Play p. 27, Max p. 28, Obligation p. 30, Ownership and Control p. 31,
  Play, Put Into Play p. 32, Player Side Scheme p. 34, Response p. 38, Search p. 39, Shuffle and Setup p. 40, Star
  Icon p. 40, Team-Up p. 43, Temporary p. 44, Tuck and Unique Icon p. 45, "Would" and When Defeated p. 48, "You, Your"
  p. 49, Appendix I p. 50, Appendix II p. 51.
- **Errata:** none for this box (RRG 1.8 Appendix V; data survey §0 item 6; sources §6).
- **FFG rulings after 1.8** (`marvel-champions-rulings-post-rrg-1-7.md`): June 25, 2026 R2 and R3; July 9, 2026 R1;
  August 3, 2026 R1, R5, R6; August 13, 2026 R1, R2 (§4.0).
- **The MC60 rulebook**, read through `docs/campaign-modes/markdown/mc60_fear_no_evil.md`: Featured Keywords p. 3
  (Discount, Starting), Featured Terms p. 4 (Exactly Defeat, Player Side Schemes, Tuck), Starter Decks p. 25, Sense deck
  and FAQ p. 26. It is FFG's product rules text: it governs where RRG 1.8 is silent and yields where they conflict.
- **Scans read this session** (`assets/card-art/bundles/cards/`): 60007 (Elektra prints "Forced Interrupt (Hero)"),
  60012 (Focus the Senses: threat 4, no per player icon; cost 0), 60040a (Photographic Reflexes prints a **star** in the
  cost field). The data survey checked 60001a/b and 60037a/b.

**Corrections to the earlier pages** (the main session folds them in):

1. **Photographic Reflexes prints a star cost, not a dash** (scan 60040a). The data survey's §5 and §6 say "dash"; §1.2
   gives the shape.
2. **The Daredevil ally 60039 matches the Daredevil identity**, and the Echo ally 61038 (`jj`) matches Echo. RRG p. 45,
   second bullet: "the subtitle or alter-ego title of one matches the title, subtitle, or alter-ego title of the other".
   60039 is "Daredevil, subtitle Matt Murdock"; 60001b's alter-ego title is Matt Murdock. 61038's subtitle is Maya Lopez.
   The sources page (§4, §8.4) says they do not match. This is the case See No Evil, Hear No Evil 60055 exists for (§3.14).
3. **RRG 1.8 "Find" (p. 19) already lists the exclusions** the insert repeats (facedown encounter cards, the victory
   display, …), and `findCards` (`select.ts`) implements them. The sources page's §3 says the RRG is silent; nothing is owed.
4. **The Acute Tactility ruling is August 3, 2026 R1**, not July 9, 2026 R1 (data survey §8). July 9 R1 is about
   Powerful Punch and Spider-Sense.

## 1. Schema decisions (owner: `game-rules-architect`; data work by `card-data-pipeline`)

### 1.1 The Sense deck (settles data survey §12 Q1 and sources §10 Q10)

60001a carries one `IdentitySeparateDeck`: `name: "Sense"`, 60002–60006 one copy each, `topCardFaceup: true`,
`discardPile: "none"`, `whenEmpty: "stayEmpty"`, `cardFamily: "player"`, plus **two new optional flags**:

- `fixedOrder: true`: "you cannot change the order" (MC60 p. 26). The deck is shuffled once, at setup ("shuffle all
  five of Daredevil's Sense cards together"), and never again: no search of it shuffles it (the cards' "(Do not
  shuffle.)" is this flag, not three scripts), `shuffleDeck { separateDeck }` and any reorder do nothing to it.
- `ownerMayLookThrough: true`: "you can look through it at any time" (p. 26). The engine state is already readable; the
  flag tells the client (and later the netcode's redaction) that the owner sees the whole deck in order. It is "you":
  the owner, not every player.

**Why flags and not scripting.** Both sentences are rules of the deck, printed once on p. 26, and are read by every
effect that touches it (three cards today, any later "search" or "shuffle"). The Forced Interrupt that sends a leaving
Sense upgrade to the bottom of the deck is **printed text on both identity faces** (scans 60001a/b; p. 26: "the forced
interrupt on both sides of Daredevil's identity card"), so it is scripted (§3.3), not a flag. The existing no-discard
redirect (`noDiscardPileDeckFor`, `query.ts`: a card of a `discardPile: "none"` deck that would go to a discard pile,
hand or deck goes to the bottom of its own deck) stays as the backstop and agrees with the printed text.

### 1.2 Photographic Reflexes 60040a/b/c (settles data survey §12 Q2 and sources §10 Q8)

- **Three records stay three cards**, quantity 2 each (the "(x6)" of p. 25). No per-name deck limit is needed: RRG
  Appendix I (p. 50) makes the identity set an exact list ("The exact quantity of each card included in that identity
  set must be included"), and `validateDeck` already checks the set by id and counts copies by title (RRG "Copy",
  p. 13) only outside it (`deck.ts`, `copiesUpToLimit`). Status exists (verify), §3.14.
- **Cost.** The scan prints a star in the cost field. RRG "Star Icon" (p. 40): a star in a field is a reminder of a
  mandatory text-box ability for that field. Add `"star"` to `SpecialCost` (`player-cards.ts`), cost 0 alongside it, as
  `"X"` and `"dash"` are carried. The card has no triggered ability, so it is never played (RRG "Event", p. 18: an event
  is played by triggering one of its abilities); the text gives another card a play route (§3.9).

### 1.3 Corrections owed for `curation/fne.ts`

1. 60001a `thwart: 2` (scan; data survey §6).
2. 60001a `textReplace` appending "Forced Interrupt: When a Sense upgrade would leave play, place it on the bottom of the
   Sense deck instead." (scan; p. 26).
3. 60040a/b/c `specialCost: "star"` (§1.2).
4. Player side scheme threat: 60012 is 4 fixed (scan); 60024 is 4 fixed (raw `base_threat_fixed`, scan to read);
   60056 is the 40059 reprint, 3 per player, as the original's data.
5. Printed icons on player cards, already in the schema (`BaseCard.schemeIcons`, `amplifyIcons`): Cloak 60020 one
   acceleration icon; Dance with the Devil 60031 one amplify icon. Nemesis 60034 one amplify icon.
6. Keywords the parser must yield: Discount 60023 (Martial Artist), 60026 (Attorney or Police), 60027 (Martial Artist or
   Spy); Starting 60038; Team-Up 60031, 60055; Temporary 60027, 60052; Restricted 60017, 60045; Guard 60063; Victory 0
   60024, 60056; "Play under any player's control" 60028.
7. Form-specific triggers printed with a parenthesized form: Elektra 60007 "Forced Interrupt (Hero)" (scan), Pawn of the
   Kingpin 60064 "When Revealed (Alter-Ego)" / "(Hero)". The trigger's `form` is its controller's (or revealing
   player's) form, as "Hero Interrupt" is.

### 1.4 Two questions the data survey asked for the later packs (settled now)

- **"Attach to a card." (Mitigated Threat 61040, `jj`).** A new `AttachmentHost { kind: "anyCard" }`: any faceup card in
  play (RRG "Attach To", p. 8, a "game element"). The `attach` effect already accepts any card in play
  (`apply-effect.ts`); the host kind is the data and `attachment-hosts.ts` half. Built with pass 2 (§6.2).
- **"This scheme does not count against the player side scheme limit." (61007, `jj`).** Ability text, through the
  existing `RuleSpec excludedFromPlayerSideSchemeLimit` (docs/phase7-wave7.md §3.2). No card flag.

### 1.5 Glossary

`GlossaryBox` gains `"cycle11"`; entries for Sense deck, Discount, Starting, Exactly Defeat, Player Side Scheme Limit
and Tuck (Echo), each sourced to MC60 p. 3, 4 or 26 (data survey §5).

## 2. Setup needs

- **Daredevil.** The Sense deck is built from §1.1 by `createGame` and shuffled at RRG Appendix II step 6 with the player
  decks (`setup-steps.ts` already shuffles separate decks there); from then on `fixedOrder` holds. Its top card is
  faceup (`syncSeparateDeckTop`).
- **Starting (§3.6).** Between step 13 (campaign setup) and step 14 (draw cards, RRG p. 51): each player whose deck holds
  a Starting card may search their deck for it and add it to hand; the deck is then shuffled (RRG "Search", p. 39). It
  counts toward the hand size (MC60 p. 3: "That card does count against their hand size and can be discarded for the
  mulligan"), which step 14's wording ("until they have cards equal in number to their hand size") already implies;
  the engine's `startingHandCredit` carries it.
- **Echo.** No setup of her own.
- **Precon decks.** Daredevil / Justice and Echo / Protection from MC60 p. 25, as listed in the data survey §10 (the
  rulebook's Echo list, with Strength and no Stick; not MarvelCDB decklist 63934).

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Every status comes from a search by name (2026-10-18) of `packages/engine/src`
(`spec.ts`, `abilities.ts`, `trigger-events.ts`, `query.ts`, `select.ts`, `deck.ts`, `flow.ts`, `ctx.ts`, `resolve/*`),
`packages/cards/src/dsl` and the content schema. Statuses as in wave 10: **new**, **extend** (an existing primitive
needs one more case), **exists (verify)** (found by name, not run for this card: the scripting agent proves it in its
module test, and a failure becomes an extend), **exists (compose)**. Searches that found nothing are named.

| §    | Primitive                                                                             | Needed by                     | Status           |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------- | ---------------- |
| 3.1  | A separate deck in fixed order, open to its owner                                     | the Sense deck                | extend           |
| 3.2  | Play a card from a separate deck: its top card, or any card ignoring its cost         | 60001a, 60009, 60018          | extend           |
| 3.3  | A leaving card placed on the bottom of its separate deck instead                      | 60001a/b                      | extend           |
| 3.4  | An interrupt to the removal of a scheme's last threat                                 | 60002, 60003                  | extend           |
| 3.5  | Threat removable only by one identity, every removal bound                            | 60012                         | extend           |
| 3.6  | Starting                                                                              | 60038                         | new              |
| 3.7  | Exactly defeat a side scheme                                                          | 60028                         | new              |
| 3.8  | A card in play lets its controller play the card tucked under it as if from hand      | 60030                         | extend           |
| 3.9  | A hand card's permission: discard it to play a tucked event; the play marked `via`    | 60040a/b/c, 60037a            | extend           |
| 3.10 | "Use your DEF in place of your THW and ATK"                                           | 60052                         | extend           |
| 3.11 | "An upgrade that can attach to a minion or side scheme"                               | 60030                         | extend           |
| 3.12 | Moving an upgrade in play to another legal host                                       | 60012                         | exists (verify)  |
| 3.13 | Player upgrades on enemies and schemes: who triggers, defense label, defeating player | 60002–60006                   | exists (verify)  |
| 3.14 | Deck building: the six Photographic Reflexes, unique matches, the Team-Up swap        | 60040a–c, 60039, 60055, 60031 | exists (verify)  |
| 3.15 | Rulings on behavior the engine already covers                                         | §4.0                          | exists (verify)  |
| 3.16 | Reusable as is (checked by name)                                                      | the rest of §7                | exists (compose) |

### 3.1 A separate deck in fixed order, open to its owner

- **Text.** MC60 p. 26: "shuffle all five … Place it faceup next to your identity and you can look through it at any
  time, but you cannot change the order." 60009, 60012, 60018: "(Do not shuffle.)".
- **Exists.** `IdentitySeparateDeck` (`identity.ts`), `shuffleSeparateDeck` (`resolve/cards.ts`), called by setup
  (`setup-steps.ts`), by `shuffleDeck { separateDeck }` (`apply-effect.ts`) and by a find's searched decks
  (`shuffleSearchedDeck`, `resolve/find.ts`); `reorderCards`. Searches that found nothing: `fixedOrder`, `lookThrough`.
- **Shape.** The two flags of §1.1, validated in `validation.ts`. `shuffleSeparateDeck` shuffles a `fixedOrder` deck only
  during setup; a search or choice from it leaves the rest in order; `reorderCards` on it does nothing (logged). The
  flags are copied into the player's separate-deck state so the client can read them.
- **Tests.** After setup the order is a seeded shuffle; Deposition takes the third card and the other four keep their
  order; a find that names a Sense card leaves the order; Storm's Weather deck still shuffles on a search.

### 3.2 Play a card from a separate deck

- **Text.** 60001a "Action: Play the top card of the Sense deck as if it were in your hand (paying its cost)."; 60009 and
  60018 "choose any upgrade from the Sense deck and play it, ignoring its resource cost. (Do not shuffle.)".
- **Rules.** RRG "Play, Put Into Play" (p. 32): a play, so cost, form, max and unique apply and it counts as played
  (Sensory Overload and Move in Shadow hear it).
- **Exists.** `EffectSpec playFromHand` with `from: "hand" | "setAside" | "deck" | { tuckedUnder }`, `ignoreCost`,
  `costReduction`; `playableTopOfDeck` covers the player deck only. Searches that found nothing: `playFromZone`,
  `asIfInHand`, `playFromSeparateDeck`.
- **Shape.** `from: { separateDeck: name, position: "top" | "any" }`. `"top"` offers only the top card; `"any"` lets the
  player pick any card of the deck the play could legally make. No shuffle afterwards for a `fixedOrder` deck (§3.1); a
  deck without it shuffles as `"deck"` does. `cardPlayed` carries `from: "separateDeck"`.
- **Tests.** Superhuman Senses with 1 resource plays the top card onto an enemy and the next card becomes the top; with
  no resource it is not offered. The Man Without Fear plays the fourth card for 0 and the order of the rest holds.

### 3.3 A leaving card placed on the bottom of its separate deck instead

- **Text.** 60001a/b "Forced Interrupt: When a Sense upgrade would leave play, place it on the bottom of the Sense deck
  instead."
- **Rules.** RRG "Would" (p. 48): higher timing priority than interrupts to the leaving itself, and a replaced leaving
  hears no further interrupts. RRG "Leaves Play" (p. 27): discard, defeat, victory display, removal from the game. A cost
  that discards the card is still paid (RRG FAQ "Rocket Raccoon (#29A)", p. 61, as `discardFromPlayDestination` reads
  it; August 3, 2026 R1: Acute Tactility "discards first, allowing Focus the Senses to retrieve it").
- **Exists.** `EffectSpec replaceLeaveDestination { to: { tuckedUnder } }` (wave 9 §3.20, tuck only, and it does not
  replace an attachment leaving with its host); the `noDiscardPileDeckFor` backstop (discard, hand, deck only).
- **Shape.** `to: { separateDeck: name, at: "bottom" }`, for the owner's deck of that name. It must also reach an
  attachment leaving with its host (a Sense upgrade on a defeated minion or side scheme) and the destinations the
  backstop does not cover (victory display, removed from game). Logged as `returnedToSeparateDeck`.
- **Tests.** Radar Sense discarded as its cost: bottom of the deck, the damage resolves. The minion it is attached to
  is defeated: bottom. A side scheme with two Sense upgrades is defeated: both at the bottom, in the order the owner
  chooses. Sensory Overload does not fire (nothing entered play).

### 3.4 An interrupt to the removal of a scheme's last threat

- **Text.** 60002, 60003 "Interrupt: When you defeat attached enemy or remove the last threat from attached scheme,
  discard this card → …".
- **Rules.** RRG "Interrupt" (p. 25): resolves immediately before the triggering condition. August 3, 2026 R1 and
  August 13, 2026 R2: the interrupt to the last threat's removal precedes the scheme's defeat, and Focus the Senses'
  When Defeated comes after it.
- **Exists.** `requireResults: { lastThreatRemoved: 1 }` on a `removeThreat` **response** (wave 7 §3.34;
  `resolve/event.ts`), `on.either`, `characterDefeated` with `PlayerRef defeatingPlayer`. Escape the Museum (wave 3)
  scripted a printed interrupt as a response because its effect changed the scheme. Search that found nothing:
  `wouldRemoveLastThreat`.
- **Shape.** `EventPattern.removesLastThreat: true` on a `removeThreat` interrupt: matches while the pending removal's
  amount is at least the scheme's threat and the threat is above 0, read as the window opens; `playerIn: you` for
  "you remove". Works on the main scheme too (no defeat follows). The enemy half is `characterDefeated` with
  `defeatingPlayer` you, joined with `on.either`.
- **Tests.** The two rulings: Acute Tactility on Focus the Senses, Daredevil removes the last 2: Acute Tactility
  discards (bottom of the Sense deck) and readies him, then When Defeated can put it back into play. On the main
  scheme: the interrupt fires, nothing is defeated. A removal of 1 from a 2-threat scheme: no window.

### 3.5 Threat removable only by one identity, every removal bound

- **Text.** 60012 "Threat cannot be removed from this scheme except by Daredevil or Matt Murdock."
- **Rules.** RRG "Identity" (p. 23): a title names that face only, so both titles name the identity. RRG "You, Your"
  (p. 49): events, resources and upgrades (unless on another friendly character) are extensions of the identity;
  allies, supports and player side schemes are not. "Cannot" is absolute (RRG p. 11), so encounter removals are bound too.
- **Exists.** `RuleSpec threatCannotBeRemoved` with `exceptBy` (binds only a character's removal, so Foggy Nelson's
  support removal would get through) and `exceptThwartBy` (lets only thwarts through, so an unlabeled removal by
  Daredevil's own upgrade would not); `TargetQuery.extensionOf` (`select.ts`).
- **Shape.** `exceptFromSource: TargetQuery`: binds every removal and lets through one whose removing card is the
  identity or an extension of it (`{ extensionOf: <the Daredevil player> }`).
- **Tests.** Daredevil's basic thwart, Living Lie Detector, Superior Taste and Matt Murdock's Deposition remove; Foggy
  Nelson, Blindspot, another player's event and an encounter card's removal do not, and Focus the Senses is not a
  legal target for their thwarts.

### 3.6 Starting

- **Text.** 60038 "Starting. (You may add this card to your hand before drawing your starting hand.)"
- **Rules.** MC60 p. 3 (RRG 1.8 has no entry): "Each deck cannot include more than one card with starting. Before
  drawing their starting hand during player setup, each player with a starting card in their deck may search their deck
  for that card and add it as the first card of their starting hand. That card does count against their hand size and
  can be discarded for the mulligan."
- **Exists.** The keyword in the schema (`keywords.ts`, `"starting"`) and the parser; `startingHandCredit` and
  `EffectSpec countTowardStartingHand` (wave 8 §3.44); `executeDrawStartingHands` (`flow.ts`). No enforcement found.
- **Shape.** A setup step before `drawStartingHands`: each player in player order is offered their Starting card (a
  choice; declining is allowed), it moves to hand, the deck is shuffled, and the hand gains one credit. A deck
  validation fault for two or more Starting cards (`deck.ts`). A campaign's deck surgery runs before it.
- **Tests.** Echo's precon takes Innate Reflexes and draws 4 more (hand size 5); declining draws 5. A deck with two
  Starting cards is refused. The mulligan may discard it.

### 3.7 Exactly defeat a side scheme

- **Text.** 60028 "Response: After you thwart and exactly defeat a side scheme, exhaust Stealth Training → stun an
  enemy."
- **Rules.** MC60 p. 4, the only source for schemes (August 3, 2026 R6 covers characters only): "defeated by a thwart that
  did not attempt to remove more threat than was necessary". Engine reading of "a thwart": each removal instruction of
  a thwart is its own attempt, so Know Your Enemy's second "Remove 1 threat" can exactly defeat a 1-threat scheme (MC60
  p. 25: "Know Your Enemy and Stick help you defeat side schemes exactly").
- **Exists.** `schemeDefeated { defeatedByPlayerId, sourceInstanceId }`; characters' `ValueSpec defeatExcessDamage`.
  Searches that found nothing: `exactlyDefeat`, `excessThreat`.
- **Shape.** `removeThreat` records the attempted amount; `schemeDefeated` gains `excessThreat` (attempted minus the
  threat that was there) and `byThwart`. A predicate `exactlyDefeated` reads `excessThreat === 0` on a thwart's defeat,
  and `defeatExcessDamage === 0` from an attack for a character.
- **Tests.** THW 2 on a 2-threat side scheme: exact; on 1: not. Stick's −1 makes it exact. Foggy Nelson's removal of 2
  on 2: not a thwart, no response.

### 3.8 A card in play lets its controller play the card tucked under it

- **Text.** 60030 "You may play the upgrade tucked here as if it were in your hand."
- **Exists.** `AbilityTriggerSpec.playableTopOfDeck` (a constant permission listed by `legalActions`, wave 8 §3.49);
  `playFromHand.from.tuckedUnder` inside an action (Med Lab).
- **Shape.** Generalize the permission to `playableFrom { player, zone: "deckTop" | { tuckedUnder: TargetRef },
  costReduction? }`, keeping `playableTopOfDeck` as its `"deckTop"` case. The card is played at its own timing (an
  upgrade in its player's turn) and leaves the tuck as it enters play.
- **Tests.** The tucked upgrade is offered in the hand list and played onto a minion; with Contingency Planning gone
  (the tuck discarded, RRG "Tuck", p. 45) nothing is offered.

### 3.9 A hand card's permission to play a tucked event

- **Text.** 60040a/b/c "If you are in hero form, you can discard Photographic Reflexes from your hand to play an event
  tucked under Echo as if it were in your hand. Reduce the cost to play that event by 2. You cannot trigger Echo's
  'Watch and Learn' ability for that event."
- **Rules.** MC60 FAQ p. 26: usable whenever the tucked event could be played from hand (an Action in the player's turn,
  a Response when its condition occurs); the event then goes to its owner's discard pile (RRG "Event", p. 18).
- **Exists.** §3.8 after it lands; `Predicate playedVia` (read from the play frame only); `cardPlayed` has no `via`.
- **Shape.** `playableFrom` with `activeIn: "hand"`, `form: "hero"`, an additional cost "discard this card from hand"
  (paid with the play: RRG "Cost", p. 13) and `costReduction: 2`. `cardPlayed` gains `via: InstanceId`, readable by an
  `EventPattern` (`playedVia`), so Watch and Learn excludes plays via a Photographic Reflexes. A star-cost card with no
  triggered ability is never offered as a play of its own (§1.2).
- **Tests.** A tucked Action event played in Echo's turn for its cost minus 2 (not below 0), the Reflexes discarded,
  Watch and Learn not offered, Echo's Katana and Improvisation offered. A tucked Response event (Powerful Punch) played
  from the interrupt window of an enemy attack. Not offered in alter-ego form.

### 3.10 "Use your DEF in place of your THW and ATK"

- **Text.** 60052 "Your hero gets +1 DEF. Use your DEF in place of your THW and ATK. (Ignore any modifiers to your THW
  and ATK.)"
- **Rules.** June 25, 2026 R3: basic thwart uses DEF; Go All Out uses DEF for each; As One! uses DEF in place of ATK.
  So every read of the hero's THW and ATK, not only basic powers.
- **Exists.** `modifyBasicPower.useStat` (an interrupt to one use, wave 6 §3.32); `thwartWithAtk` (a scheme rule);
  `characterStat` (`query.ts`).
- **Shape.** `RuleSpec statInPlaceOf { target, stats: ["thw", "atk"], use: "def" }`, read inside `characterStat` /
  `characterProfile`: the stat is the character's DEF with its DEF modifiers, and THW and ATK modifiers are ignored.
  Consequential damage stays on the field used (wave 6 Q22).
- **Tests.** DEF 3 with The Best Offense: basic thwart 4, basic attack 4, Cross-Examination-style "equal to your ATK" 4;
  a +2 ATK upgrade changes nothing.

### 3.11 "An upgrade that can attach to a minion or side scheme"

- **Text.** 60030 "Choose 1 upgrade in your hand that can attach to a minion or side scheme."
- **Exists.** `TargetQuery.canAttachToCategory: "ally"` (wave 8 §3.59, card data only); `hostAllowsCategory`.
- **Shape.** Widen to `"ally" | "minion" | "sideScheme"`, an array meaning any of them. Same card-data reading (owner
  decision wave 8 Q30 = A): no host in play needed.
- **Tests.** Legal Trouble and Chance Encounter qualify; Stealth Training and a Sense upgrade (in no hand) do not.

### 3.12 Moving an upgrade in play to another legal host

60012's When Defeated: "move any number of Sense upgrades in play to other cards they can attach to". `EffectSpec
attach` re-hosts a card already in play after `canAttachTo` (`apply-effect.ts`); hosts are chosen with
`TargetQuery.canHaveAttached`. Moving is not entering play (no Sensory Overload). Focus the Senses itself is in play
until its When Defeated resolves (January 11, 2026 R1), so it is a legal host and the card goes to the bottom with it.

### 3.13 Player upgrades on enemies and schemes

- Only the controller triggers them: RRG "Interrupt" (p. 25) and "Response" (p. 38), "only on cards they control";
  MC60 FAQ p. 26 says the same of Sense upgrades.
- They are extensions of the identity (RRG p. 49; not on a friendly character), so "you defeat", "you attack attached
  enemy", "you thwart attached scheme" read the identity.
- Heightened Hearing 60004's "Hero Interrupt (defense)": the identity becomes the defender (RRG "Labeled Ability",
  p. 26; `AbilityLabel "defense"`), so the controller becomes the target of an attack made against another player.
- `on.enemyAttacks(…, { by: "host" })`, `characterDefeated` + `defeatingPlayer`, `modifyAttack`,
  `reduceNextCardCost`, `AttachmentHost anyOf [enemy, scheme]`.

### 3.14 Deck building

- Photographic Reflexes: §1.2 (`identitySetMembers`, `copiesUpToLimit`).
- Daredevil ally 60039 matches the Daredevil identity (§0, correction 2): refused in a deck with that identity, and in
  play while it is in play (RRG p. 45). An Echo player at a table with Daredevil may replace it with See No Evil, Hear
  No Evil 60055 (RRG Appendix I, p. 50; `deck-team-up-replacement.test.ts`). Team-Up play condition (RRG p. 43):
  friendly characters titled or subtitled Daredevil and Echo; Dance with the Devil needs an Elektra (the ally 60007).
- "Max 1 per deck" (60031, 60055, 60057–60059), "Max 1 per player" (60027, 60028, 60030, 60054): RRG "Max" (p. 28).

### 3.15 Rulings on behavior the engine already covers

Each is a `rules-qa-engineer` test (§4.0 lists them); a failure becomes an extend.

### 3.16 Reusable as is (checked by name against the engine unions and the DSL)

| Printed text (card)                                                                                              | Existing vocabulary                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "When Elektra would take consequential damage, Daredevil takes that damage instead" (60007)                      | `replaceTriggeringEvent` with `dealDamage`; consequential pattern; trigger `form: "hero"`          |
| "For each upgrade attached to that enemy, you may deal 1 additional damage" (60008, 60010 threat)                | `chooseNumber` up to `countInRef(attachmentsOf(target, upgrade))`                                  |
| "Deal 2 damage to each enemy for each upgrade attached … (3 if Aerial)" (60011)                                  | per-target damage (`damage-per-target`), `hasTrait`; question 1                                    |
| "Return this card to your hand → choose" (60017); "Daredevil gains Aerial until end of round"                    | `returnToHand` cost, `chooseOne`, `grantTraitUntil`                                                |
| "Exhaust this card and deal 1 damage to Daredevil → choose" (60018)                                              | damage-self cost (`damage-self-cost`), §3.2                                                        |
| "Matt Murdock gets +3 REC"; "After you recover, discard a status card" (60016)                                   | stat modifier on a named face, `basicRecovery` response, `removeStatus`                            |
| "After an Attorney character or support defeats a side scheme, confuse an enemy" (60015)                         | `schemeDefeated`, `eventSource` with `extensionOf` / trait, `giveStatus`                           |
| "Exhaust Cloak and spend [energy][energy] → find Dagger and put her into play" (60020)                           | `spendResources`, `findCard` to play                                                               |
| "Cloak loses each [acceleration] icon"; "-1 consequential damage" (60021)                                        | `RuleSpec gainsIcon { loses }`, consequential damage scope rule                                    |
| "spend [energy] ([energy][energy] if the villain) → confuse that enemy" (60022)                                  | conditional cost (`conditional-cost`), an `attack` interrupt by self                               |
| Discount X (trait) (60023, 60026, 60027)                                                                         | `discountFor` (`actions.ts`), once whatever the matches (MC60 FAQ p. 26) (verify)                  |
| "Remove an acceleration token from play" (60024)                                                                 | `removeAccelerationToken`                                                                          |
| "Temporary. Max 1 per player. After you play a card (including this one)" (60027)                                | the keyword, `cardPlayed` response on self (Silk 52033 precedent)                                  |
| "Interrupt: When a friendly Martial Artist uses a basic power, choose …" (60029)                                 | `basicPowerUsing`, `modifyBasicPower`, `chooseOne` with an option condition `ready(self)`          |
| "Tuck that upgrade under here (to a maximum of 1)" (60030)                                                       | `tuckCards` from hand, `RuleSpec tuckLimit`                                                        |
| "Choose 2 of the following (you may choose the same option twice)" (60055)                                       | `chooseOne { count: 2, allowRepeat }`                                                              |
| Watch and Learn: tuck from that player's discard pile; "discard all but 3" (60037a)                              | `cardPlayed` response, `tuckCards`, Silk's state check (wave 9 §3.39); §3.9 `via`                  |
| "When you change to hero form, search your deck for an … event" (60037b)                                         | `formChanging` interrupt, `chooseCards` deck, shuffle                                              |
| "Reduce the cost of the next event you play this round by 1" (60039)                                             | `reduceNextCardCost` until end of round                                                            |
| "Search any player's discard pile … add that card to your hand" (60041)                                          | `choosePlayer`, `takeIntoHand { keepOwner }` (August 13, 2026 R1)                                  |
| "Heal X … where X is the highest cost among cards tucked under her" (60042)                                      | `superlative` over `tuckedUnder`, `printedCost`                                                    |
| "Generate a [wild] resource for an event being played by any player" (60043)                                     | resource trigger `forAnyPlayer` with a card filter                                                 |
| "Deal damage equal to that event's printed cost. This attack gains piercing." (60045)                            | `printedCost` (per player, August 3, 2026 R5), attack keyword grant                                |
| "Add an event tucked under Echo to your hand" (60047)                                                            | `moveCards` from `tuckedUnder` to hand                                                             |
| "Increase the cost to play this card by 1 for each ally you control" (60048, 60050)                              | hand cost modifier (`costModifiers activeIn: "hand"`)                                              |
| "While you do not control any allies, +1 DEF and retaliate 1" (60053)                                            | constants with `while`                                                                             |
| "When an enemy attacks you (before any defender is declared) … ready your hero" (60054)                          | `enemyAttack` interrupt                                                                            |
| Obligations staying in play (60032, 60060); "place that threat here"; "You cannot deal damage to Kingpin"        | Paparazzi (wave 6), `placeThreat` on self, `cannotTakeDamage { fromSource: { extensionOf: you } }` |
| "When Kingpin would attack the Maya Lopez player, he schemes instead" (60061)                                    | `replaceTriggeringEvent` with an enemy scheme                                                      |
| "Attach to the enemy with the highest ATK"; "attach this card to Elektra" (60035)                                | `AttachmentHost superlative { measure: "atk" }`, `attach`                                          |
| "When Bullseye attacks, give him a facedown boost card" (60034); "Bullseye attacks you (even in alter-ego form)" | `giveBoostCard`, enemy attack against a chosen player                                              |
| Boost: "If Kingpin is in play, reveal this scheme" (60062); "this card gains surge" (60064)                      | `revealCard(self)` from a boost, `gainSurge`                                                       |
| Reprints 60025, 60051, 60056, 60057–60059                                                                        | aliased to 26034, 32014, 40059, 01088–01090 (wave 10 `hercules/basic.ts` precedent)                |

## 4. Rulings and open questions

### 4.0 Rulings and rules text this pass follows

| Source                             | What it settles                                                                                                        | Cards                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| June 25, 2026 R2 (RRG p. 26)       | Aggressive Energy adds +1 to each enemy Raising Hell damages (2 upgrades: 4 + 1)                                       | 60011                     |
| June 25, 2026 R3                   | The Best Offense: every THW and ATK read uses DEF (§3.10)                                                              | 60052                     |
| July 9, 2026 R1                    | Powerful Punch does not make an attack "initiated against" Spider-Man                                                  | 60051                     |
| August 3, 2026 R1; Aug 13, 2026 R2 | Acute Tactility's interrupt precedes the defeat; Focus the Senses' When Defeated follows every interrupt (§3.4)        | 60002, 60012              |
| August 3, 2026 R5 (RRG p. 32)      | A per player printed cost is multiplied (Team Investigation: 4 in two players)                                         | 60045                     |
| August 3, 2026 R6                  | Exactly defeating a character: no excess damage (§3.7)                                                                 | 60028 (characters)        |
| August 13, 2026 R1                 | A stunned Echo's attack event still counts as played; a borrowed event cannot be tucked                                | 60037a, 60041             |
| MC60 FAQ p. 26                     | Sense upgrades: controller only; Photographic Reflexes' timing; the tucked event to its owner's discard; Discount once | 60002–60006, 60040, 60023 |
| RRG FAQ "Rocket Raccoon" p. 61     | A discard cost whose card goes elsewhere is still paid (§3.3)                                                          | 60002, 60003, 60005       |

**The sources page's conflicts, settled by the order.** Vulnerable (RRG p. 48) and Steady (RRG p. 41) touch only
scenario cards (pass 1b). Amplify: RRG p. 7 ("during an enemy activation") governs; the insert's character case
(p. 4) needs a scenario card to matter, so pass 1b decides whether anything implements it. Dance with the Devil's amplify
icon (a player card on an enemy) counts like any amplify icon in play, under either text. Exactly defeat for schemes and
Starting come from the insert because the RRG is silent (§3.6, §3.7). The Sense deck rules come from p. 26 (§1.1).

### 4.1 Rules questions for the owner

Only what the authority order does not settle. Until a question is answered, A is built.

| Q   | Question                                                                                                    | A (default)                                                                                             | B                                                                     | Decision |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| 1   | Raising Hell (60011) and an enemy with no upgrades: "deal 2 damage to each enemy for each upgrade attached" | Not attacked: no damage instruction names it (no retaliate, no "after attacked")                        | Attacked for 0 (retaliate and "after … attacked" fire, guard applies) | open     |
| 2   | Focus the Senses' When Defeated: may a Sense upgrade be moved onto Focus the Senses itself?                 | Yes, it is in play until the ability resolves (January 11, 2026 R1); it then goes to the bottom with it | No: "other cards" excludes the scheme being defeated                  | open     |

Question 1: RRG "Labeled Ability" (p. 26) makes the whole event one attack, and the engine reads "each enemy" as naming
every enemy (wave 8 Q48); June 25, 2026 R2 speaks of "each enemy damaged by the effect" but does not say who is
attacked. Question 2 is a corner of the text: "other cards they can attach to" reads as other than the current host.

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`.** §1.1–§1.5; `cycle11` in `fne.ts`; the Daredevil and Echo starter decks; `wave11.test.ts`
  (data survey §11, §13). Read the scans for 60024, 60031, 60020 and 60034 before emitting the icons and threat.
- **`ability-scripting-engineer`.** §8.4, one module per task; reprints aliased; every "(verify)" row proved in the
  module's own test before it is relied on.
- **`rules-qa-engineer`.** One test per §4.0 row, colocated with the card module or in a dated `qa-` file.
- **`game-client-engineer`.** The Sense deck beside Daredevil's identity: faceup top card, the whole deck in order to its
  owner (`ownerMayLookThrough`); cards tucked under Echo and under Contingency Planning; Photographic Reflexes offered as
  a play of the tucked event; the Starting choice at setup. Card hover on all of them.
- **`encounter-ai-designer`.** Nothing new: the nemesis cards use existing enemy behavior.

## 6. Later passes (placeholders)

### 6.1 Pass 1b: the box's scenarios and campaign

Blocked: the six villains, the main schemes, the six modular sets, the scenario sets and the five campaign
environments are in neither the raw cache nor MarvelCDB (data survey §0, §3; owner question 1 there). When the cards
exist this pass covers per-player main schemes (Protection Racket), Typhoid Mary's flip each villain phase, charge,
speed and Public Support counters, the Raft's Master Key, the Daily Bugle loss condition, nemesis minions sharing a
title with a villain (Kingpin, Bullseye, Purple Man), Vulnerable, Steady and Amplify as §4.0 says, and the campaign's
scenario choice and environments (`campaign.ts` already models MC60's choice and progress marks).

### 6.2 Pass 2: Jessica Jones (`jj`)

Mitigated Threat's `anyCard` host and 61007's limit exemption as §1.4 decided; Prerequisite enforcement (form or trait,
checked as the card is played); Alias Investigations' evidence counters and the "exactly defeat the villain's stage"
response; the three Suggestion obligations; Purple Man's stats read from characters in play; the Luke Cage ally 61003
against the Luke Cage identity (unique match through the alter-ego title).

### 6.3 Pass 2: Luke Cage (`luke_cage`)

Any number of tough cards; "attacks against him lose piercing" (`attacksLoseKeywords`, wave 10 §3.18);
unpreventable damage when a tough card is discarded; Metal Bracer and the June 25 / July 9, 2026 rulings on costs paid
with damage; Hulk's rage counters; Cottonmouth's repeat attack.

## 7. Card coverage (pass 1a)

Module paths are relative to `packages/cards/src/wave11/fne/`. "§" names the primitive each card waits on; "—" means
§3.16 only.

### 7.1 Daredevil (`daredevil/`)

| Code     | Card                                            | Needs                   | Module                  |
| -------- | ----------------------------------------------- | ----------------------- | ----------------------- |
| 60001a/b | Daredevil / Matt Murdock                        | §3.1, §3.2, §3.3        | identity                |
| 60002    | Acute Tactility                                 | §3.3, §3.4, §3.13       | sense-deck              |
| 60003    | Enhanced Olfaction                              | §3.3, §3.4, §3.13       | sense-deck              |
| 60004    | Heightened Hearing                              | §3.3, §3.13             | sense-deck              |
| 60005    | Radar Sense                                     | §3.3, §3.13             | sense-deck              |
| 60006    | Superior Taste                                  | §3.3, §3.13             | sense-deck              |
| 60008    | Cross-Examination                               | —                       | events                  |
| 60009    | Deposition                                      | §3.2                    | events                  |
| 60010    | Living Lie Detector                             | —                       | events                  |
| 60011    | Raising Hell                                    | question 1              | events                  |
| 60007    | Elektra                                         | —                       | support-upgrades-allies |
| 60012    | Focus the Senses                                | §3.5, §3.12, question 2 | support-upgrades-allies |
| 60013–16 | Foggy, Karen, Nelson and Murdock, Sister Maggie | —                       | support-upgrades-allies |
| 60017    | Daredevil's Billy Club                          | —                       | support-upgrades-allies |
| 60018    | The Man Without Fear                            | §3.2                    | support-upgrades-allies |
| 60032    | Sensory Overload                                | —                       | obligation-nemesis      |
| 60033–36 | Bullseye set                                    | —                       | obligation-nemesis      |

### 7.2 Echo (`echo/`)

| Code     | Card                                                                    | Needs | Module                  |
| -------- | ----------------------------------------------------------------------- | ----- | ----------------------- |
| 60037a/b | Echo / Maya Lopez                                                       | §3.9  | identity                |
| 60040a–c | Photographic Reflexes                                                   | §3.9  | events                  |
| 60041    | Study the Tape                                                          | —     | events                  |
| 60039    | Daredevil (ally)                                                        | §3.14 | support-upgrades-allies |
| 60042–47 | The Rez, ASL, Choreography, Echo's Katana, Improvisation, Muscle Memory | —     | support-upgrades-allies |
| 60060    | Raised by the Kingpin                                                   | —     | obligation-nemesis      |
| 60061–64 | Kingpin set                                                             | —     | obligation-nemesis      |

### 7.3 The box's aspect and basic cards (`aspect-basic/`)

| Code         | Cards                                                                                                                            | Needs       | Module     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 60019–60027  | Blindspot, Cloak, Dagger, Ghost Rider, Know Your Enemy, De-escalation, Chance Encounter (reprint), Legal Trouble, Move in Shadow | —           | justice    |
| 60028        | Stealth Training                                                                                                                 | §3.7        | justice    |
| 60038        | Innate Reflexes                                                                                                                  | §3.6        | protection |
| 60048–60051  | Army of One, Get Their Attention, In Harm's Way, Powerful Punch (reprint)                                                        | —           | protection |
| 60052        | The Best Offense...                                                                                                              | §3.10       | protection |
| 60053, 60054 | Ronin, Stand Alone                                                                                                               | —           | protection |
| 60029, 60031 | Stick, Dance with the Devil                                                                                                      | —           | basic      |
| 60030        | Contingency Planning                                                                                                             | §3.8, §3.11 | basic      |
| 60055–60059  | See No Evil, Hear No Evil; Superpower Training, Energy, Genius, Strength (reprints)                                              | §3.14       | basic      |

## 8. Build order (pass 1a)

### 8.1 Data first

`card-data-pipeline`: §1.3 corrections, the Sense `separateDecks` entry with the §1.1 flags (after engine task 1 adds
them to the schema), `SpecialCost "star"`, the two starter decks, `cycle11`, registration, the glossary entries, and
`wave11.test.ts`. One commit for the schema value and its validation, one for the emitted pack.

### 8.2 Engine queue, in order

One agent at a time, one primitive per task, one commit each with the §3 tests. "After N" is a dependency.

1. §3.1: `IdentitySeparateDeck.fixedOrder` and `ownerMayLookThrough` (schema, validation, engine shuffles and reorder).
2. §3.2: `playFromHand.from { separateDeck, position }`. After 1.
3. §3.3: `replaceLeaveDestination.to { separateDeck, at: "bottom" }`, attachments leaving with their host included.
   After 1.
4. §3.4: `EventPattern.removesLastThreat` on a `removeThreat` interrupt.
5. §3.5: `threatCannotBeRemoved.exceptFromSource`.
6. §3.6: the Starting setup step and the one-per-deck validation.
7. §3.7: `excessThreat` and `byThwart` on `schemeDefeated`; `Predicate exactlyDefeated`.
8. §3.8: `playableFrom` (the generalized `playableTopOfDeck`) with the `tuckedUnder` zone.
9. §3.9: `playableFrom` active in hand with a discard-self cost; `cardPlayed.via`; star-cost cards not played. After 8.
10. §3.10: `RuleSpec statInPlaceOf` in `characterStat`.
11. §3.11: `canAttachToCategory` widened to minion and side scheme.

### 8.3 The "exists (verify)" rows

§3.12 to §3.15 and every "(verify)" line of §3.16 are proved by the scripting agent's own module test before the
module relies on them. A failure is reported, not worked around in the script, and becomes an extend task appended to
§8.2.

### 8.4 Scripting order

`ability-scripting-engineer`, one agent per line, one module per line, at most three at once. "Waits on" lists §8.2
task numbers.

1. Scaffold: `wave11/card-groups.ts`, the registries, the coverage guard, and `fne/daredevil/identity.ts` (60001a/b).
   Waits on 1, 2, 3.
2. `fne/daredevil/sense-deck.ts` (60002–60006). Waits on 3, 4.
3. `fne/daredevil/events.ts` (60008–60011). Waits on 2.
4. `fne/daredevil/support-upgrades-allies.ts` (60007, 60012–60018). Waits on 2, 5.
5. `fne/daredevil/obligation-nemesis.ts` (60032–60036). After line 1.
6. `fne/echo/identity.ts` (60037a/b). Waits on 9.
7. `fne/echo/events.ts` (60040a–c, 60041). Waits on 9.
8. `fne/echo/support-upgrades-allies.ts` (60039, 60042–60047). After line 1.
9. `fne/echo/obligation-nemesis.ts` (60060–60064). After line 1.
10. `fne/aspect-basic/justice.ts` (60019–60028). Waits on 7.
11. `fne/aspect-basic/protection.ts` (60038, 60048–60054). Waits on 6, 10.
12. `fne/aspect-basic/basic.ts` (60029–60031, 60055–60059). Waits on 8, 11.
13. Daredevil / Justice precon game, standard, to a win and to a loss. After lines 1–5, 10, 12.
14. Echo / Protection precon game, the same. After lines 6–9, 11, 12.
15. Daredevil and Echo together: the Daredevil ally swapped for See No Evil, Hear No Evil (§3.14), a Sense upgrade
    triggered only by its controller, Echo tucking Daredevil's played aspect event. After lines 13 and 14.
