# Gwenpool (`gwenpool-ptt`)

A fan-made hero pack by PatataSaurio (G.Triskelion template, Spanish community): Gwenpool / Gwendolyn Poole, 15 hero
cards (Batroc, a speech-bubble kit), the Too Much Pink obligation and a 5-card nemesis set (Game Rules, Evil Gwenpool,
"I Found You" x2, "Hello Again"). See `CREDITS.md` and `PERMISSION.md`.

**Languages.** Spanish is the author's canonical version and is the base language of the pictures (`languages.base`
is `es`); the English text and pictures are the author's own translation, and the card text in the data is English
(`languages.text` is `en`, the importer's `textLanguage`).

**Status.** The curated source marks this pack `waiting_author`: BluefireF5ran's three rules-only fixes (below) were
posted to the author on 2026-11-10 and are not confirmed yet. The pack follows the curated version.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `decks/`, `extensions.json` and `abilities/index.ts` are in git. The
pictures (`cards/<lang>/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release bundles.
For a local build run `sh fetch-art.sh` (it clones the curated source repository at the pinned commit and renames the
pictures to the pack's card codes). Without the pictures `mc-pack build` still works, as this pack has no `altArt`.
The Vitest tests (`packages/mod-sdk/src/community-packs.test.ts`, `gwenpool-ptt.test.ts`) build the pack from a copy.

## How it was made

`mc-pack import-marvelcdb <gwenpool_ptt> --out content-packs/community/gwenpool-ptt --id gwenpool-ptt` (source commit
`3a5dff953ec7f2d64473039874fb6568693aa3f6`), then by hand:

- `cards/*.json`: each speech bubble is an ability on its card (`<code>.pink-bubble`, `.purple-bubble`),
  added to the importer's list. The hero face's counted bubble is `01a.pink-bubble` (its second, a quip, is not counted), the
  alter-ego face one (`01b.pink-bubble`); every other player card has one, every nemesis card one purple bubble. The
  importer's `x_bubbles` (in `extensions.json`) says which bubbles are instructions (`rules: true`) and which flavor.
- `abilities/index.ts`: every ability and bubble, each commented with the base card it copies and the author's rule.
- `decks/gwenpool-ptt-pool.json`: a suggested deck (not the author's; the source has no precon list): the 15
  Gwenpool cards plus the 24 'Pool aspect cards of the Deadpool ('Pool) starter deck plus the basic card Haymaker
  (40 cards).

Re-running the importer would overwrite the card JSON: redo the bubble ids above.

**The curator's three rules fixes** (made in the source, none changes a mechanic): Evil Gwenpool's Forced Response now
reads "After Evil Gwenpool attacks you" (it had no trigger); That's Not How the Game Ends in English gets "by an enemy
attack", to match the Spanish card; the two nemesis treacheries put Evil Gwenpool "engaged with the Gwenpool player", so
it works while she is in alter-ego form. **Not included:** two Spanish-only team-up basics (`Aspecto/` in the source: a
team-up with Deadpool and one with a Spider-Warrior); there is no English version of them.

## How the bubbles are modeled

Each bubble is a tagged ability with no trigger (`tagged("pinkBubble", ...)`, engine commit ead4f84e3). It resolves only
when an effect names its tag, and it counts while its card is in play (in hand: its printed bubbles). A flavor bubble
has no effects and still counts.

- **Reading the comic** (hero ability): `resolveOneTagged("pinkBubble")`, the player picks one pink bubble in play
  (flavor ones included) and only it resolves; once per round.
- **That's Not How the Game Ends**: removes itself from the game, then `resolveTagged("pinkBubble", { of: self })`: every
  pink bubble in play, its own too (the author's rule), in the order the player chooses.
- **Precise Cut, Plot Armor**: `taggedAbilitiesOn("pinkBubble", { controller: "you" })`, live and each bubble counted; a
  blanked text box counts none.
- **Too Much Pink**: `hasTaggedAbility("pinkBubble")` on a support, upgrade or ally in hand (+2) and on the cards
  discarded for its action (events count).
- **Evil Gwenpool**: `gets("hp", taggedAbilitiesOn("purpleBubble"))` and `resolveTagged("purpleBubble")` after it attacks
  you.

The author's readings of the bubbles' dialogue (ENGINE_NOTES), as scripted:

| Bubble                                                                | Script                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Hero: "Draw 1 card now"                                               | `draw(1)`                                                        |
| Batroc: "remove 2 threat from a scheme"                               | remove 2 threat from a scheme (not a thwart)                     |
| Comic Shop: "Sorry to deal you 2 damage"                              | 2 damage to an enemy (not to you)                                |
| That's Not How the Game Ends: "Lift the top card of the villain deck" | reveal the top encounter card; revealing it resolves it (a risk) |
| Handbook: "I drop a [wild] resource"                                  | text only: see Open items                                        |
| Game Rules (purple): "Discard 1 card at random from your hand"        | discard 1 random card from the resolving player's hand           |
| Evil Gwenpool (purple): "Deal 2 damage to Gwen"                       | the player Evil Gwenpool attacked takes 2 damage                 |

## New engine primitives this pack uses

`tagged`, `resolveOneTagged`, `resolveTagged`, `taggedAbilitiesOn`, `hasTaggedAbility`,
`replaceNextVillainPhaseWithPlayerPhase` (Out of the Game), `loseKeywordUntil` and `loseTraitUntil` (Handbook), all from
`packages/cards/src/dsl/engine-only-features.ts`.

## Scripted and not

**Fully scripted:** both identity abilities, Batroc, Precise Cut, Plot Armor, Secrets From the Comics, Out of the Game,
That's Not How the Game Ends, Comic Shop, Too Much Pink, Game Rules, Evil Gwenpool, "I Found You", "Hello Again", and
all 16 bubbles.

**Partly scripted (what is missing):**

- **That Shouldn't Be There.** Scripted as a choice among: move 1 threat between schemes, move 1 all-purpose counter
  between cards, move 1 acceleration token to a main scheme, move 1 status card (stunned, confused or tough) to another
  character, and the "from / to the pool" versions of each (take 1 threat, acceleration token or status card from the
  pool; return one to it). **Not expressible:** moving a damage token (it takes a removal that is not a heal and is not
  dealt; the DSL only has `heal` and `placeDamage`), and any typed counter other than an all-purpose one (placing one
  from the pool needs the counter's name, and a move from a card needs the type).
- **Marvel Champions Handbook.** "Ignore one keyword, trait or status card on one card until the end of the round":
  keyword (20 keywords, one option each, offered when a card in play has it) and trait (a curated list of 33 common
  traits, offered when a card in play has it) are scripted with `loseKeywordUntil` / `loseTraitUntil`. **Not
  expressible:** ignoring a status card (no lasting "ignore status" primitive), and "any trait on that card" (the
  trait is named in the script, so a trait outside the list cannot be chosen; the missing piece is a
  `loseTraitUntil` that takes a trait chosen from the card).

## Open items

- **Author's confirmation.** The three rules fixes above were posted on 2026-11-10 and are not confirmed.
- **Handbook's bubble ("I drop a [wild] resource! Well, let's not waste it").** The author's reading is a free [wild]
  resource for a card being paid for now, and a resource generated with nothing to pay for is lost. A bubble resolves
  from an Action or an Interrupt, never in the middle of a payment, so it resolves into nothing and only counts as a
  bubble. A resource that a bubble gives to a payment already in progress needs a tagged ability that can generate
  resources (no such primitive).
- **Permission.** The curated source records "granted, inclusion" with no date, and says nothing about the Spanish
  version beyond the author having made both languages. Ask BluefireF5ran for the date and evidence.
- **Two Spanish-only basics** are not included (no English card).

## Rules readings made (the pack's own text is the authority; flagged for the author)

- **Two bubbles on the hero face.** Only the first counts as her pink bubble. The second ("What? Am I in a card game
  now?") is a flavor quip, so the most Precise Cut or Plot Armor can count is 6, one per card, as ENGINE_NOTES says
  (the owner, 2026-11-11).
- **Evil Gwenpool is set aside at setup.** She is the nemesis minion, so RRG 1.8 "Nemesis Encounter Set" (p. 30) sets
  her aside; the Standard set's Shadow of the Past brings her in. The two treacheries search "the encounter deck and
  discard pile", so they bring her back after she was defeated and discarded, and do nothing while she is in play (the
  author: intended). In a game where she is still set aside they find nothing.
- **"Hello Again": "Otherwise, discard 1 upgrade you control at random".** The curator updated the card (source commit
  `3a5dff953e`, 2026-11-11): the old fallback ("If no cards were put into play this way, discard 1 upgrade card at
  random") did not say where the upgrade came from. "Otherwise" is the case where Evil Gwenpool is in play: the revealing
  player discards 1 of the upgrades they control, picked at random by the game's seeded RNG; nothing happens if they
  control none. While she is not in play nothing is discarded, even if the search finds nothing (she is still set
  aside). The curator's ENGINE_NOTES phrase it as "if no card was put into play", which would also discard in that
  set-aside case; the pack follows the card text. Flagged for the author.
- **"I Found You" / "Hello Again": "the Gwenpool player".** The player whose identity is Gwenpool in either form; in a
  multiplayer game another player may reveal the card and Evil Gwenpool still engages the Gwenpool player.
- **Game Rules.** "Treat Gwenpool's printed text box as if it were blank (except for TRAITS)" blanks the hero side only
  (the author's reading): the rule targets the identity whose face showing is titled "Gwenpool", so in alter-ego form
  (Gwendolyn Poole) "That's not fair!" works. The blank also silences her hero face's bubbles (they are printed text),
  so Precise Cut and Plot Armor lose them. "Cannot leave play while Evil Gwenpool is in play" is absolute.
- **That's Not How the Game Ends** applies in hero form only (it names Gwenpool), and only to a defeat by an enemy
  attack: damage from Evil Gwenpool's purple bubble or any other card is not answered by it. Its own bubble resolves
  even though the card is out of the game by then (the author's rule), which can reveal a treachery or a minion.
- **Out of the Game.** A Forced Interrupt to the villain phase beginning: the phase does not start, an extra player phase
  does, in the same round: no threat is placed, nothing is dealt or revealed, the first player token stays, "once per
  round" limits do not refresh and "until the end of the round" effects carry on. The extra phase ends with the normal
  discard, draw and ready; the next end of turn runs the villain phase.
- **Secrets From the Comics.** "Mention one of his secrets" is table flavor and is skipped.
- **Reading the comic** may pick any pink bubble in play, whoever controls it, including a flavor one (which does nothing).
- **Plot Armor / Precise Cut** are labeled "(defense)" / "(attack)": Precise Cut's 2 + X is one attack with overkill.
- **Too Much Pink** raises supports, upgrades and allies only (the text), not events, which still have a pink bubble and
  count for its discard action.
- **Batroc** shares a unique title with the official Batroc villain (50086) and minion (50161): it cannot be played
  while either is in play (not a bug).

## Tests

`packages/mod-sdk/src/gwenpool-ptt.test.ts` plays the abilities on the real engine against the Core Rhino scenario:
Reading the comic (one bubble of your choice, once per round), Precise Cut and Plot Armor counting bubbles (and none
under Game Rules), Too Much Pink's +2 and its discard-2 removal, Evil Gwenpool's hit points and its purple bubbles after
it attacks, That's Not How the Game Ends (replacement, removal, every bubble incl. its own and the reveal; not offered
against non-attack damage), Out of the Game (extra phase, no threat, same round, limits not refreshed), Game Rules
(hero side blank only, cannot leave play), "I Found You" / "Hello Again", That Shouldn't Be There (threat, status) and
the Handbook (a trait ignored until the end of the round). `community-packs.test.ts` builds the pack and plays 3 seeds
of its deck.
