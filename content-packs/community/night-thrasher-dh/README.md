# Night Thrasher (`night-thrasher-dh`)

A fan-made hero pack by DesignHacker (Hitch template, Spanish by Francisco Merchan): Night Thrasher / Dwayne Taylor,
his double-sided Battle Board upgrade, 14 more hero cards, the Practice obligation and a 5-card nemesis set (Terrax the
Tamer, Cemented, Cosmic Connection x2, Cosmic Ax). See `CREDITS.md` and `PERMISSION.md`.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `decks/` and `abilities/index.ts` are in git. The pictures
(`cards/<lang>/`, `alt-art/<lang>/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release
bundles. For a local build run `sh fetch-art.sh` (it clones the curated source repository at the pinned commit and
renames the pictures to the pack's card codes; the alternate alter-ego `night_thrasher_dh_01b-alt.webp` becomes
`alt-art/<lang>/x.night-thrasher-dh.01b.webp`). Without the pictures `mc-pack build` fails on `altArt`; the Vitest tests
(`packages/mod-sdk/src/community-packs.test.ts`, `night-thrasher-dh.test.ts`) build a copy without that list instead.

## How it was made

`mc-pack import-marvelcdb <night_thrasher_dh> --out content-packs/community/night-thrasher-dh --id night-thrasher-dh`
(the importer applies the Battle Board's dash-cost curation by itself: front `02a`, hidden flip side `02b`), then by hand:

- `abilities/index.ts`: every ability, each commented with the base card it copies.
- `cards/x.night-thrasher-dh.01a.json`: `deckbuilding.offAspectAllowance` (Dwayne's Tech Deck, below).
- `cards/x.night-thrasher-dh.02a.json`: four extra ids for Practice's lock on the Battle Board
  (`02a.practice-lock`, `02a.practice-clear`, `02b.practice-lock`, `02b.practice-clear`).
- `decks/night-thrasher-dh-aggression.json`: a suggested deck (not the author's; the source has no precon list): the
  Battle Board and the 15 Night Thrasher cards, plus the Core Set Aggression and basic cards of the Iron Man
  (Aggression) starter deck, with the 2 Tac Team swapped for 2 Heroic Intuition (a Justice Skill upgrade) so the deck
  uses Tech Deck. The Battle Board is permanent and does not count toward the deck size (RRG 1.8 p. 32).

Re-running the importer would overwrite the card JSON: redo the two card edits above.

## New engine primitives this pack uses

From engine commit b51277136 (`packages/cards/src/dsl/engine-only-features.ts`): `agile` (Battle Board front),
`lastPlayedThisRound` (Kickflip), `blankTextBoxForPlayers` (Cemented). Nothing is left unscripted.

## Open items

- **Alternate alter-ego, hit points.** `alt-art/en/` prints **10** hit points on the masked Dwayne Taylor; the author
  confirmed it should be **9**, and the Spanish picture prints 9. The card data says 9 (`x.night-thrasher-dh.01a`,
  `hp`) and is what the game uses; only the English alternate picture is wrong. Ask the author for a corrected file.
- **Errata not yet submitted.** The source notes the Cemented and Practice errata have not yet been submitted by the
  author to the community, so those two may change; the Battle Board's was cleared for the game.
- **Tech Deck is partial.** "You may include up to 4 Skill cards in your deck from aspects other than your own" is
  `IdentityDeckbuilding.offAspectAllowance`, whose `cardType` names one card type. It is set to `upgrade` (about two thirds of the
  Skill cards of the four aspects are upgrades: Combat Training, Heroic Intuition, ...), so Skill **events,
  supports and resources** of other aspects (Mean Swing, Skilled Strike, Ever Vigilant, Deflection, Target Practice,
  Audacity, ...) are refused by the deck builder although the card allows them. A `cardType` list (or none) in the
  schema would fix it. Skill cards of the basic aspect are always legal.
- **Permission.** The curated source records "granted, inclusion" with no date. The Spanish pictures are Francisco
  Merchan's work on the author's art; the scope does not name translation (Carnage's permission does). Ask
  BluefireF5ran for the date and evidence, and whether inclusion covers the Spanish version.
- Questions for the author, none sent: the readings below.

## Rules readings made (the pack's own text is the authority; flagged for the author)

- **Battle Board.** "Night Thrasher gets +1 THW / +1 ATK and +1 DEF" is read in hero form (the stat bonus; as Vision's
  Dense, 26002b). Agile 1 is the author's own keyword (not in the RRG; his reminder text is the definition): damage
  taken from an undefended villain or villainous attack is reduced by 1, so Night Thrasher defending, or an ally
  defending, is not reduced. It stacks with other reductions and is read before toughness. "After you flip to this
  side" is the card's own flip (`cardFlipped`), heard by the face that is up afterwards; a Response, so optional. The
  front's is a plain Response, the back's a Hero Response.
- **Varial Heelflip.** Any Skill card counts: events, and also upgrades, supports, allies and resources with the Skill
  trait (Prewind Stance, Combat Training). Limit once per phase. After Disaster or Kickflip, which flip the board
  themselves, it can flip it back.
- **Dwayne Taylor's Manual.** "Shuffle X Skill cards from your hand into your deck -> draw X cards": the DSL has no
  hand-to-deck cost, so the shuffle is the first effect, not a cost; X may be 0 (as Shield Toss's open question). Limit
  once per round. The draw happens after the shuffle, so a shuffled card may be drawn again.
- **Kickflip.** "A Night Thrasher event" is an event of his identity set (`identitySetOf`). The cost reduction reads the
  last card played this round before this one, so it is not read once Kickflip itself is being paid for.
- **Disaster, Melon Grab, Kickflip, Escrima Sticks** are "(attack)" / "(attack/thwart)" labeled, so their damage is an
  attack (retaliate, guard and "after you attack" apply). Melon Grab's 8 damage is not conditional on the Battle Board:
  Vehicle lets it be divided, Weapon adds piercing and overkill. The Battle Board back's response damage ("deal 1
  damage to an enemy") is not an attack.
- **Escrima Sticks.** "Your attacks" is Night Thrasher's own (basic attacks and his events), not an ally's.
- **Drop In.** A Hero Response to any change of form; it is only offered in hero form, i.e. after a change to hero form.
- **Practice.** "Exhaust your alter-ego or discard 1 card from your hand -> remove Practice from the game" is two
  options (RRG 1.8 "Cost", p. 13): exhausting needs the player to be a ready alter-ego (the errata), discarding needs a
  card in hand. "You cannot flip the Battle Board until the start of the next villain phase" is a practice counter on
  the board that its two faces enforce (`practice-lock`: `cannotFlip` on a Battle Board holding the counter) and clear
  as the next villain phase begins (`practice-clear`, a Forced Interrupt, so before an optional one such as Prewind
  Stance). The exact form is a lasting `applyRuleUntil({ kind: "cannotFlip" }, "nextVillainPhaseBegins")`; it is not
  used because the SDK's feature list has no `expr:cannotFlip` (no base card has a lasting flip lock), so a pack with it
  would be refused by a client that can run it. An entry in `ENGINE_ONLY_DSL_EXAMPLES` would let Practice use it.
- **Cemented.** "Players cannot make basic attacks with heroes or allies or flip upgrades or identities": three
  unscoped rules (basic attacks, `cannotFlip` on upgrades, `cannotChangeForm` for each player: an identity's flip is its
  change of form). Each player answers the Action for themselves, in player order; a player who discarded treats the
  text box as blank until the end of the phase, which lifts all three rules for that player only (a second player's
  hero is still held).
- **Cosmic Connection.** "Your hero has a Weapon card in play" is read literally (ENGINE_NOTES, the author is fine with
  it): in hero form and controlling a Weapon-trait upgrade, support or ally. The Battle Board's back is a Weapon, so it
  counts. In alter-ego form the condition fails and the card gains surge. The 3 indirect damage is dealt to you, and
  "no damage was taken this way" reads the characters the indirect damage reached.
- **Terrax the Tamer / Cosmic Ax.** "You" is the player Terrax is engaged with. The Ax attaches to Terrax (data); if it
  cannot, the 8-card discard finds Terrax and reveals him, and the Ax attaches to him. Eight cards often empty the
  encounter deck and add acceleration; the author intends this (ENGINE_NOTES).
- **Prewind Stance** is a Hero Interrupt to "your turn begins" or "the villain phase begins"; its cost is exhausting it.
- **Multi-Skilled** is a plain Resource (both forms), generating a [wild] resource only for a Skill card.
