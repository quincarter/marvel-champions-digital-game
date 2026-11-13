# Throg (`throg-ptt`)

A fan-made hero pack by Patatasaurio and Caurel (G.Triskelion template, Spanish community): Throg / Puddlegulper, 15 hero
cards around the Frogjolnir upgrade (Thor's hammer, in a frog's hands), the Between Two Worlds obligation and a 5-card
nemesis set (Thanos, An Unexpected Guest, Power Stone, Inevitable Power x2). See `CREDITS.md` and `PERMISSION.md`.

**Languages.** Spanish is the authors' canonical version and the base language of the pictures (`languages.base` is
`es`); the English text and pictures are Francisco Merchán's translation, and the card text in the data is English
(`languages.text` is `en`, the importer's `textLanguage`).

**This pack is a DRAFT** (the `DRAFT` file): the generic community-packs test and the publish workflow skip it until the
file is removed. The curated source marks it `waiting_author`: the curators' rules fixes (below) were sent to the
authors on 2026-10-30 and 2026-11-07 and are not confirmed. The owner decides when to remove the file. Its own tests are
`packages/mod-sdk/src/throg-ptt.test.ts`.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `decks/` and `abilities/index.ts` are in git. The pictures
(`cards/<lang>/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release bundles. For a
local build run `sh fetch-art.sh` (it fetches the curated source repository at the pinned commit and renames
`throg_ptt_NN[a|b].webp` to the pack's card codes, `x.throg-ptt.NN[a|b].webp`). The pack has no alternate art.

## How it was made

`mc-pack import-marvelcdb <throg_ptt> --out content-packs/community/throg-ptt --id throg-ptt` (source commit
`a51e50da556ece0b0fe9a75848320416b8794cef`), then by hand:

- `abilities/index.ts`: every ability, each commented with the base card it copies.
- `cards/x.throg-ptt.13.json`: the Power Stone's `attachesTo` is edited to the card's own text: Thanos, and if he is not
  in play, the villain (`ifAble` of a `namedCard` then `villain`; the importer wrote only the Thanos half).
- `decks/throg-ptt-protection.json`: a suggested deck (not the authors'; the source has no precon list): the 15 Throg
  cards plus the Core Set Protection and basic cards of the Black Panther (Protection) starter deck, without Black
  Panther's own 15 (40 cards).

Re-running the importer would overwrite the card JSON: redo the Power Stone edit above.

## The curators' rules fixes (in the source text, sent to the authors)

Power Stone "Attach to Thanos. If Thanos is not in play, attach to the villain."; Thanos and An Unexpected Guest "find the
Power Stone and put it into play"; Between Two Worlds discards "from your hand"; Hammer Throw's "ignores" covers the
thwart ("this thwart ignores crisis and patrol"); Thor's subtitle is ODINSON.

## Scripted and not

**Fully scripted:** Throg's Asgard trait and Toad-ally Unexpected!, Worthy, Frogjolnir, Frog of Thunder, Frogbolt (X cost,
piercing with Aerial), Telepathic Link, Defender of the Nine Puddles, Amphibious Agility, Thor, Between Two Worlds,
Thanos, An Unexpected Guest, Power Stone (attach, hand-off after a 3-damage attack, hero action), Inevitable Power and
Hammer Throw: its attack ignores guard for the whole attack (`attack(4, chosen("enemy"), { ignores: ["guard"] })`, so
the villain can be chosen past a guard minion; RRG 1.8 "Ignore", p. 23, "Guard", p. 21) and its thwart ignores crisis and
patrol.

**Engine primitives still needed:** none.

## Rules readings made

- **Frogbolt's cost is X** (`specialCost: "X"`, `cost: -1` on MarvelCDB): X is the value named at play and the resources
  paid; the damage is an attack on the villain (guard applies, as to any attack on a villain) and the removal is a thwart
  on each side scheme at once. Piercing is two branches of the same attack (the keyword is fixed on the effect).
- **Throg gains Asgard while you control Frogjolnir**: a trait grant to his hero face only (the alter-ego face has no
  such text). Granted traits count for Frog of Thunder's "hero or ally with the Asgard trait" (RRG 1.8 "Gains", p. 21).
- **Defender of the Nine Puddles puts the side scheme into play, it does not reveal it** (ENGINE_NOTES): no When Revealed
  (An Unexpected Guest's Power Stone search does not run), its Hinder and starting threat apply, and Toad-ally
  Unexpected! hears it (any side scheme entering play, whoever's).
- **Telepathic Link searches your collection** (the game's card pool, from the five aspects, "from any aspect"). Pet is
  not an official trait, so it finds a Pet card only if a pack gives one that trait; Asgard cards are plentiful.
- **Amphibious Agility** is an interrupt to damage from an attack (Backflip's trigger) with a partial prevention (Wiggle
  Room's); with the Aerial trait it prevents 5 instead of 3.
- **Thor** triggers on his own attack that defeats an enemy (Beta Ray Bill's trigger); the threat removal is not a thwart.
- **Between Two Worlds**: the discard of an Asgard or Pet card is not a cost (no arrow), so the option is always
  available: with no such card in hand nothing is discarded and you are still confused.
- **Power Stone**: "deals 3 or more damage ... with a single attack" is read as damage dealt (a prevented or toughed hit
  counts), from a hero (an identity in hero form, not an ally) or a villain (not a minion) to the attached character, and
  the Stone goes to the attacker. Its hero action costs 2 resources of any type and attaches it to another hero. Its
  stat boxes (+1 ATK, +1 SCH) are data.
- **Unique clashes**: Thanos (the nemesis minion) and Power Stone share titles with official unique cards; the RRG
  unique rule (v1.8 "Unique") keeps the second one out of play. Not a bug.
- **Pet and Frog are not official traits**; the data carries them as printed.

## Tests

`packages/mod-sdk/src/throg-ptt.test.ts` plays the abilities on the real engine against the Core Rhino scenario:
validation, the suggested deck and a 2-game smoke test; Frogjolnir (+1 ATK, Aerial, Asgard) and Frog of Thunder; Worthy
(once per round); Hammer Throw (4 damage, 4 threat, Frogjolnir back to hand); Frogbolt (X damage, X threat from each side
scheme); Defender of the Nine Puddles with Toad-ally Unexpected! (5 damage, not revealed, draw 2); Amphibious Agility (3,
and the whole hit with Aerial); Thanos and An Unexpected Guest finding the Power Stone (on Thanos, on the villain); the
Stone moving to a hero who hits for 4; Inevitable Power (2 in hero form); Between Two Worlds' second option.
Not covered: the Power Stone's hero action, Telepathic Link (a collection search needs a pool with Pet or Asgard cards),
Thor's response, Inevitable Power's 3 damage with the Stone on Thanos and the alter-ego half.
