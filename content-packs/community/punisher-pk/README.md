# The Punisher (`punisher-pk`)

A fan-made scenario pack by PermaKarma (Hitch template, English and Spanish pictures rebuilt by Francisco Merchan): The
Punisher I to III, the Frank's War main scheme, the War on Crime environment, the Micro attachment, 9 minions (4 Maggia
Thugs), 3 side schemes and 5 treacheries, played with the recommended modular set **Sinister Syndicate** (the base game's
`hood` set, `sinister_syndicate`). Standard plays The Punisher I and II, expert II and III. See `CREDITS.md` and
`PERMISSION.md`.

**This pack is a draft** (the `DRAFT` file): the author has not confirmed the curators' fixes, Rachel Cole-Alves is the
curators' proposal, and five lines wait for engine primitives. Remove `DRAFT` when those are settled.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `scenarios/` and `abilities/index.ts` are in git. The pictures
(`cards/<lang>/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release bundles. For a local
build run `sh fetch-art.sh` (it clones the curated source repository at the pinned commit and renames the pictures to
the pack's card codes: the villain's stages II and III are the pictures `01b` and `01c` of card `01`).

## How it was made

`mc-pack import-marvelcdb <punisher_pk> --out content-packs/community/punisher-pk --id punisher-pk`, through
`importMarvelCdbPack` with a curation (the CLI takes none):

- `corrections` for Rachel Cole-Alves (`dashedMinionStats: ["atk", "sch"]`: she prints a dash for both, which the source
  record leaves out) and for War on Crime (`definedCounterTypes: ["war"]`), and a `cardNotes` entry for Rachel (the
  normalizer's ask for a printed dash).

Then by hand:

- `scenarios/punisher-pk-punisher.json`: the scenario record (villain I to III, main scheme `04a`, standard stages I and II,
  expert II and III, recommended modular `sinister_syndicate`). War on Crime starts in play through its own
  `Permanent. Setup.` keywords.
- `cards/x.punisher-pk.01.json`: the importer gave the villain's stages II and III ability ids on card numbers `02` and `03`
  (cards the pack does not have), which the validator rejects; they are renamed to `01.<slug>-ii` / `-iii`, and a third
  ability per stage (`minions-cannot-attack-*`) is added for "Minions cannot attack or stun him", printed in the first
  ability's box.
- `abilities/index.ts`: every ability, each commented with the base card it copies.

Re-running the importer would overwrite the card JSON: redo the edits above.

## Engine primitives still needed (marked `TODO(engine)` in `abilities/index.ts`, each pinned by a test named so)

1. **Ignore Boost abilities, icons still count** (The Punisher, all three stages): his attack on a minion deals a boost
   card whose icons add to the ATK but whose "Boost:" ability does not resolve. `ignoreBoost` ignores both together.
2. **Cannot be stunned by minions** (The Punisher): a rule filtered on the source of the status card.
3. **Activates before the villain** (Barracuda, Bullseye, Hammerhead, Jigsaw, The Russian): a per-minion flag read by
   villain phase step 2.
4. **Extra boost card on an attack against a minion** (Jigsaw): `extraBoostCards` applies to an activation, not to an
   `enemyAttacksEnemy`.
5. **Boost icons count twice** (Extreme Prejudice): a doubling modifier on `boostIconsCounting`, scoped to the Punisher's
   attacks on minions.

Besides these, one engine question: Sinister Syndicate's Shocker and Speed Demon (`hood` 24045, 24046) answer
`{ on: "attack", selfIs: "target" }`, a player-side attack. The Punisher's attack is an `enemyAttacksEnemy`, so today
neither hears it, and a villain is a character ("After a character attacks Shocker"). The curators' README expects both
to react to him (and "Minions cannot attack or stun him" is there to stop it), so those two scripts (or the pattern)
need to hear `enemyAttacksEnemy` too. `punisher-pk.test.ts` pins what happens today.

## Open items

- **The author has not confirmed** the curators' rules and wording fixes (`mod.json` status `waiting_author`).
- **Rachel Cole-Alves** is the curators' proposal (engaged with a player; The Punisher cannot attack her), not the author's
  card, whose version attaches her to The Punisher.
- **Questions for the author**, none sent: Maggia Capo's search with no Criminal minion left (read: the discarding stops at
  the end of the deck, RRG 1.8 "Encounter Deck", p. 17, and nothing comes into play); whether the 6[per_hero] war counter
  lock is meant as the doom clock; Bullseye's 1[per_hero] war counters.
- **Unique clashes** only if mixed with official sets: Jigsaw (56028), Bullseye (56088, 60033), the Hammerhead villain
  (60086).
- **Permission.** The source records "granted, inclusion" with no date or evidence (`PERMISSION.md`).

## Rules readings made (the pack's own text is the authority; flagged for the author)

- **The Punisher attacks each minion engaged with you.** `forEachCard` over the minions engaged with the player he
  activated against, one `enemyAttacksEnemy` each, with a boost card (FFG ruling January 26, 2026 (4), the Headpool
  ruling); the first player orders them. It is not an activation, so it does not trigger his own "After The Punisher
  activates against you": no loop. His activation can be a scheme (alter-ego form): it triggers all the same, as printed.
- **"Defeated by The Punisher or by an encounter card"** (the war counter): the source of the defeating damage is an
  encounter card (a card with no controller), which includes The Punisher himself and every minion, so an ally defeated by
  a minion's attack or retaliate counts. A hero's or ally's attack does not.
- **War on Crime's hazard icon**: "1[per_hero] hazard icon" is one icon per player (the engine's icon count is a number,
  so there is one rule per player count, 1 to 4).
- **Maggia Thug.** "Ignore Maggia Thug when resolving Frank's War's Forced Interrupt" is applied on Frank's War as a name
  filter: a player engaged only with Maggia Thugs counts as not engaged with a minion. Frank's War runs in player order.
- **Collateral Damage.** "Discard a Location or Vehicle ... Then take 3 indirect damage. If no card was discarded this way,
  this card gains surge": by "Then" (RRG 1.8 "'Then'", p. 44) the damage resolves only when a card was discarded, so with
  none the card only gains surge. The other reading (damage and surge) doubles the penalty; ask the author.
- **Explosive Surprise.** The minion with the fewest remaining hit points is any minion in play, not only yours; a tie goes
  to the first player to pick.
- **The Russian.** "Defeated by a friendly character or a player card" is read as any defeating source that has a
  controller, so The Punisher's own attacks (an encounter card) defeat him normally, as the curators intend.
- **Rachel Cole-Alves.** Her "+2 ATK while attacking a minion" applies to his attacks on minions only (not to his
  activation against you), and "cannot attack Rachel" also stops his attack on her from the forced response above. War
  Zone counts her as a minion in play.
- **War Zone** restricts the players' attacks (the table is bound); it does not stop his own attacks on minions.
