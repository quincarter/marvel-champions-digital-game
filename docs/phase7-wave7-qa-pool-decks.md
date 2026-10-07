# Wave 7 QA: Deadpool and 'Pool decks

Fixtures: `packages/cards/src/wave7/fixtures/pool-decks/` (TS, `DeckContents` plus a name). Tests:
`packages/cards/src/wave7/pool-decks.qa.test.ts` (72 pass, 6 `test.fails` pins).

## Rule sentences

- RRG 1.8 "Aspect Card" (p. 8): "When building a player deck, a player must choose one of the five aspects (Aggression,
  Justice, Leadership, Protection, or 'Pool) to use for customization. The remainder of their deck ... can then be
  customized with cards that belong to the chosen aspect." Appendix I (p. 50): 40-50 cards, the identity set exactly,
  "no more than three copies (by title)", aspect cards "and/or basic cards", identity "deckbuilding requirements".
- Deadpool insert (quoted in `phase7-wave7.md` §1): "You can customize any hero's deck using the 'Pool aspect as your
  chosen aspect"; with a 'Pool player, "shuffle 1 copy of the Crisis of Infinite Deadpools (#37) ... Set the rest of
  the Dreadpool modular encounter set aside."
- FAQ p. 64, Crisis of Infinite Deadpools (#37): "Is Crisis ... included ... if an ability allows a player to include one
  or more 'Pool aspect cards from outside of their chosen aspect in their deck? A: No. ... only included if at least one
  player in the game chooses the 'Pool aspect as (one of) their chosen aspect(s)."
- Adam Warlock FAQ (insert): 'Pool "can be used in place of any of the other four aspects"; other multi-aspect heroes
  "can choose the 'Pool aspect as one of those aspects."

## Deck 2 and deck 6, decided

- No rule lets Deadpool, or anyone by default, include 'Pool cards outside the 'Pool aspect. "Choose one aspect" plus
  basic cards is all the base rule gives. Deck 2 (Deadpool, Aggression) therefore holds no 'Pool card, and one 'Pool event
  is refused (`aspect_restriction`). The FAQ's "an ability allows" is the only door, and it is a printed identity text.
- That door exists: Cable's identity ("You may include player side schemes from any aspect") admits Live Dangerously
  (44024, a 'Pool player side scheme). Deck 6 is Cable, Leadership, with it: legal, 'Pool card present, no Dreadpool set.
  Gamora (up to 6 ATTACK/THWART events from any aspect) could take Cutupper / 'Pool Inspection too (not built: no fixture).
  So the guide sentence "'Pool cards in another aspect's deck don't" describes a real deck. It is accurate.

## Decks (all 40 counted cards, each hero's own set included)

1. `deadpool-pool-break-time`: Deadpool, 'Pool. Four allies, Break Time, Git Gud, Healing Factor, Distraction.
2. `deadpool-aggression`: Deadpool, Aggression. Core Aggression plus basic Haymakers, no 'Pool card.
3. `spider-man-pool`: Spider-Man (Core), 'Pool. Defense, cheap upgrades, resources, four allies.
4. `domino-pool`: Domino, 'Pool. Deadpool Corps allies, Mulligans, Live Dangerously.
5. `adam-warlock-pool`: Adam Warlock, 'Pool + Justice + Leadership + Protection (6 each, one copy per title, + Martinex).
   5b. `spider-woman-pool-justice`: Spider-Woman, 'Pool + Justice, 11 each.
6. `cable-leadership-live-dangerously`: Cable, Leadership, one 'Pool side scheme.

## Illegal, refused with exact messages (all asserted)

'Pool card under Aggression or Justice or in Cable's Leadership as an event (`aspect_restriction`: "X is a 'Pool card,
but this deck's aspect is ..."); 'Pool plus a second aspect for Deadpool or Spider-Man (`aspect_choice`: "must choose
exactly one aspect; this deck chooses 'Pool and ..."); five aspects for Adam; a fourth Barely a Scratch and a second
Adam copy (`copy_limit`); Break Time twice ("its deck limit is 1"); Cable (44002) in Spider-Man's deck
(`other_identity_card`); 44037/44038/44039 in a deck (`not_a_player_card`).

## Setup (playable builder, `rhino`)

Dreadpool: 44037 shuffled in once, six set aside (44038-44042, 'Pool-ized twice), for every fixture whose aspects include
'Pool, solo and 2-player (one 'Pool seat, or two seats: still one set). None for decks 2 and 6, alone or together
in a 2-player game. Each fixture starts and its driver plays 40 commands including non-end-turn actions.

## Findings

1. DEFECT, sharing: the app's text export (`exportDecklistText`, by title) is refused by its own text import
   (`ambiguous_card_name`) for 5 of 7 fixtures: Deadpool's ally "Cable" vs identity Cable, "Hulk", "Hawkeye", Spider-Man's
   "Web-Shooter", "Mind Scan", "Captain Marvel", "Spider-Man". Pinned with `test.fails`. Owner: card-data-pipeline / client.
2. DEFECT, MarvelCDB import: `CORE_ASPECT_NAMES` in `from-marvelcdb-json.ts` omits 'Pool, so a four-aspect Adam deck whose
   `meta` names two non-'Pool aspects cannot recover 'Pool from its cards (returns 2 aspects, then `aspect_choice`).
   Pinned (`test.fails`). 'Pool first in `meta` works.
3. Cosmetic: Adam's messages read "Adam Warlock (Adam Warlock)" (hero and alter ego share a name).
4. Rules text drift: RRG p. 8's first sentence ("Aggression, Justice, Leadership, and/or Protection") and Appendix I p. 50
   ("Justice, Aggression, Protection, or Leadership") still omit 'Pool, while the same entry's bullet and p. 12 say five.
   `validateDeck` follows five. Known (§4.1); flag for FFG.
5. Not covered: a full game per fixture (the solo driver agent plays them), Gamora's allowance with a 'Pool event, and
   Break Time / Git Gud play behavior beyond `unscriptedCards` being empty.
