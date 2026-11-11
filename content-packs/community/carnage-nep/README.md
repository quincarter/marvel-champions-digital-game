# Carnage (`carnage-nep`)

A fan-made hero pack by Neptune (Hitch template, Spanish by Francisco Merchan): Carnage / Eddie Brock, 15 hero cards,
the Essential Bloodlust obligation, a 5-card nemesis set (Torment) and the 8-card Twisted Killers modular set. See
`CREDITS.md` and `PERMISSION.md`.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `decks/` and `abilities/index.ts` are in git. The pictures
(`cards/<lang>/`, `alt-art/<lang>/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release
bundles. For a local build run `sh fetch-art.sh` (it clones the curated source repository at the pinned commit and
renames the pictures to the pack's card codes). Without the pictures `mc-pack build` fails on `altArt`; the Vitest
tests (`packages/mod-sdk/src/community-packs.test.ts`) build a copy without that list instead.

## How it was made

`mc-pack import-marvelcdb <carnage_nep> --out content-packs/community/carnage-nep --id carnage-nep`, then by hand:

- `abilities/index.ts`: every ability, each commented with the base card it copies.
- `cards/x.carnage-nep.01a.json`: `deckbuilding.offAspectAllowance` (Eddie: up to 5 Attack events from other aspects,
  the Gamora 18001b form), and two bookkeeping abilities for Need to Kill (`01a.need-to-kill-tracker`,
  `01b.need-to-kill-reset`).
- `cards/x.carnage-nep.08.json`: two extra ids (`-constant-piercing`, `-constant-ranged`): Amorphous Arsenal's bonus is
  one forced interrupt per keyword.
- `decks/carnage-nep-aggression.json`: a suggested deck (not the author's): the 15 Carnage cards plus the 25 Core
  Aggression and basic cards of the Iron Man starter deck. The author's own two lists are not in the source.

Re-running the importer would overwrite the card JSON: redo the edits above.

## Klyntar Bond's interrupt

"Hero Interrupt: When Carnage uses a basic power, you may give him a boost card." This uses the engine's
`giveBasicPowerBoostCard` effect, added for this pack: the card resolves like villainous on a friendly character
(RRG 1.8 p. 47), and its boost icons add to the basic power, as the author expects.

## Rules readings made (the pack's own text is the authority; flagged for the author)

- **Essential Bloodlust**: "Carnage's ATK" is the printed ATK (2), whether or not the player flips (ENGINE_NOTES' safe
  reading; question for the author still open).
- **Need to Kill**: "defeat an enemy" is any enemy Carnage's identity (or an event, resource or upgrade he controls)
  defeats, an attack or not; allies' defeats do not count (RRG 1.8 "You, Your", p. 49).
- **Amorphous Arsenal**: the +1 per keyword reads the attack's keywords as its interrupt window opens (the
  `Directed Force`, Psylocke 41019, timing), so a keyword gained from Arsenal's own interrupt is not counted for the
  bonus. Open: whether the author means it to count (it would need an attack-keyword count read at damage time).
- **Vicious Lashing** (action): "This attack gains ranged" is given to both of its two attacks.
- **Muse**: "the character with the fewest remaining hit points" is any character other than Muse (hero or alter-ego,
  ally, minion or villain), per the author's answer (BluefireF5ran, relayed 2026-11-11). Ties go to the first player.
  Attacking an enemy is an enemy-attacks-enemy attack (no boost card), with piercing and the excess-damage heal as well.
- **Torment / Death Spiral**: "that character" is the attacked (or defending) character; with several matching allies or
  Persona supports the attacked player chooses.
- **Closing the Loops**: "more than 2 classifications in play" is all three of identity-specific, aspect and basic among
  the cards the player controls (their identity is always in play).
- **Meticulous Targeting / Recognizing Evil** icons: acceleration, as ENGINE_NOTES reads them (check against the art).
