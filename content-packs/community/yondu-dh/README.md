# Yondu (`yondu-dh`)

A fan-made hero pack by DesignHacker with a nemesis set by BlueHG (Hitch template, Spanish by Francisco Merchán):
Yondu / Yondu Udonta, 15 more hero cards around his Yaka Arrow upgrade, the Banished obligation and a 5-card nemesis
set (Sav'rkk, Sword-Gun-Arm, Price on Your Head, Hard to Kill, Savage Destruction). See `CREDITS.md` and `PERMISSION.md`.

**This pack is a DRAFT** (the `DRAFT` file): the generic community-packs test and the publish workflow skip it until the
file is removed, which waits for the art bundle upload. Its own tests are
`packages/mod-sdk/src/yondu-dh.test.ts`.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `decks/` and `abilities/index.ts` are in git. The pictures
(`cards/<lang>/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release bundles. For a
local build run `sh fetch-art.sh` (it fetches the curated source repository at the pinned commit and renames
`yondu_dh_NN[a|b].webp` to the pack's card codes, `x.yondu-dh.NN[a|b].webp`). The pack has no alternate art.

## How it was made

`mc-pack import-marvelcdb <yondu_dh> --out content-packs/community/yondu-dh --id yondu-dh`, then by hand:

- `abilities/index.ts`: every ability, each commented with the base card it copies.
- `decks/yondu-dh-aggression.json`: the authors' own starter deck ("Yondu Deck" card in the pack; the same list as
  MC4DB deck 2040, "Whistle While You Work - Yondu Precon"), converted from the source `decks/yondu-aggression.json`:
  his 15 hero cards, 18 Aggression, 7 basic. The MC4DB side deck (3 Follow Through) is not included.

Re-running the importer would overwrite the card JSON; nothing was edited by hand in it.

## Abilities: done and approximated

All 28 abilities are scripted. Four waited for engine primitives, now in the engine (card-agnostic, each with an
example in `packages/cards/src/dsl/engine-only-features.ts` and engine tests):

1. **Yaka Arrow, "cannot be attached to cards unless it is in play"** (12): `cannotBeAttachedUnlessInPlay`. Read from
   the card wherever it is: no effect attaches it from a hand, a deck, a discard pile or a set-aside area, and played
   from hand it enters play attached to nothing, in its controller's play area, with no host asked for. Once in play,
   effects attach and move it. Source: the author (thread 2026-05-03) via ENGINE_NOTES, Yondu table.
2. **D'ast Whistlin', "attached to or removed from an enemy"** (01a): `on.cardAttachedOrRemoved`, over the engine's
   `cardUnattached` event, heard for every way the arrow leaves a host (moved to another host, returned to hand,
   discarded, its host leaving play), the host it left as `eventTarget`. A moved arrow is heard twice, removed from the
   first enemy and then attached to the second, each dealing 1 damage to its own enemy. An enemy that has left play
   takes no damage. Source: errata text of 2026-11-11 (two Responses), ENGINE_NOTES.
3. **Jackpot!, "treat the next card you spend as if it has double the resources"** (07): a lasting rule to the end of
   the round (reading settled by the authors), `applyRuleUntil(doubleNextCardSpent(), "endOfRound")`. The first card
   from hand the player spends in a later payment generates double, and the effect is used up by it. The cards spent
   with Jackpot! are spent at the same time, so none of them is "next".
4. **Sav'rkk, "Upgrades cannot be removed from Sav'rkk"** (15): `upgradesCannotBeRemoved()`. While he is in play no
   effect moves an upgrade off him, returns it to hand or discards it; when he leaves play his upgrades are discarded
   with him.

**Summon** (Crew Cut, Whistlin', Whistle While You Work, and Sav'rkk's, Hard to Kill's and Savage Destruction's finds)
is `findCard` with `anywhere`: what Find searches, and also the cards removed from the game, the victory display and the
facedown encounter cards (dealt cards, boost cards, facedown cards in play), as DesignHacker's keyword says.

### Approximations (working, narrower than the text)

- **Ravage, fragile.** The engine has no `fragile` keyword; the effect is scripted directly (attacks against a minion with
  a wound counter gain overkill, as Cruisin' for a Bruisin' 62009). The minion does not show the keyword, and nothing
  else in the pack reads it.
- **Sword-Gun-Arm, "When attached character has 2 or less remaining hit points, discard"**: read as a Forced Response after
  the host takes damage. Not caught: attached to a character already at 2 or fewer remaining (Savage Destruction's
  fallback host), or a hit point loss without damage. An exact version needs a state-condition trigger.

## Rules readings made

- **Yondu's D'ast Whistlin' and Whistle While You Work use the authors' suggested errata** (2026-11-11, awaiting
  DesignHacker; the pack is sealed so only the annual errata can change it): two Responses, and "If the Yaka Arrow
  upgrade is in play, attach it to Yondu and ready Yondu and the Tahlei upgrade. Otherwise, summon it and add it to
  your hand." If he declines, the printed English text is at the root of his zip.
- **Settled with the authors (not printed):** Jackpot! lasts to the end of the round; nothing attached to Sav'rkk can leave
  him while he is in play; Savage Destruction attacks you in alter-ego form too (an enemy attack never needs a hero form).
- **The arrow on an enemy** stays controlled by its owner (RRG 1.8 "Ownership and Control"), so "your identity", its Forced
  Interrupt and Tahlei's "attach it" all read the owner's copy (`controller: "you"`).
- **Cheap Shot / Fight Dirty** are "(attack)" labeled, so the 6 damage is an attack (guard and retaliate apply), as the
  Night Thrasher pack's attack events. The stun or confusion comes first, whatever the arrow.
- **Twirlin' and Whirlin'**: the cost is 0, so every resource paid is overpaid; the first attach is mandatory and each
  repeat is the player's choice ("may"), with a fresh choice of host. Attaching the arrow to the character it is
  already on is not an attach anew, so it triggers nothing.
- **Invest**: X is every resource paid, of any type, at least 2 (a 2-resource card pays 2). Exactly 2, exactly 3 and 4 or
  more are the three results.
- **Ravager Redshirts**: "damage from an enemy with the arrow" is read from the damage's source.
- **Yaka Arrow's Forced Interrupt**: only while attached to an enemy; the enemy being defeated is not offered as a new host.
- **Sav'rkk and the arrow's Forced Interrupt**: Sav'rkk is still in play while "when attached enemy would be defeated"
  resolves (RRG 1.8 "Interrupt", p. 25), so with his rule in force the arrow cannot be moved off him then: it is
  discarded with him. This follows "nothing attached to him can leave him while he is in play"; an earlier note here
  wanted the rule to lapse as he is being defeated so the interrupt could move the arrow. Listed in the open items.
- **`hasAttachment` inside `refMatches`** (an earlier note here said it missed the arrow): the miss came from this
  pack's tests, whose state surgery set the arrow's host without adding it to the host's attachments. The engine keeps
  both, and `arrowOn` now reads `hasAttachment` (checked in the engine's `upgrade-host-primitives.test.ts`).

## Open items

- Sav'rkk with the Yaka Arrow on him: should the arrow's Forced Interrupt still move it as he is defeated? Scripted
  as no (his rule holds while he is in play); a question for the authors.
- DesignHacker has not answered the suggested errata (above).
- Ravager Redshirts is listed at cost 3 on MC4DB; the card prints 2 and the JSON follows the card.
- Permission evidence for BlueHG (DM through DesignHacker, 2026-11-11), see `PERMISSION.md`.
