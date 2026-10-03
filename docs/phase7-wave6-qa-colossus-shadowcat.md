# Phase 7 wave 6 rules-QA pass: Colossus and Shadowcat (`mut_gen` heroes)

`rules-qa-engineer`, 2026-10-03. Scope: the Mutant Genesis box's two heroes (Colossus / Piotr Rasputin 32001 with his kit,
Homesick and the Juggernaut set; Shadowcat / Kitty Pryde 32030 with Solid / Phased, Permanently Phased and the White Queen /
Hellfire Club set) and the box's shared precon aspect and basic cards (32014 to 32018, 32021, 32050 to 32054) against RRG
1.8 (FAQ pp. 63 to 64, errata p. 68) and the post-1.7 rulings. Tests:
`packages/cards/src/wave6/mut_gen/colossus/qa.test.ts` and `packages/cards/src/wave6/mut_gen/shadowcat/qa.test.ts`; no
non-test code was touched. Page numbers are PDF pages of `mc_rulesreference_v18_compressed.pdf` (they equal the printed
page numbers).

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` and `marvel-champions-rulings-post-rrg-1-7.md` for Colossus, Piotr,
Shadowcat, Kitty Pryde, Phased, Solid, mass form, Permanently Phased, Juggernaut, tough, and every card title of both heroes'
sets, nemesis sets and the shared precon cards (Powerful Punch, Bait and Switch, Perseverance, Mutant Protectors,
Defensive Energy, Shadow and Steel, Ready to Rumble, Steel Fist, Armor Up, White Queen, Hellfire, Lockheed, Quick Shift,
Toe to Toe and so on). The MC32 rulebook (`docs/campaign-modes/markdown/mc32_mutant_genesis.md`) was read for both heroes'
notes (p. 3 "Additional Forms", p. 22 starter decks). Quotes below are what each source actually says.

| Source                                                                                                                                                                                                                                                                                                                   | Card                                                    | Where it is pinned                                                                                                                                                                                                                                                                                                                                   | Result                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Erratum p. 68, Steel Fist (#8): "Should read: 'Hero Action (attack): Deal 5 damage to an enemy. You may discard a tough status card from your hero to stun and confuse that enemy.' (Replaced cost arrow with 'to'.)", with RRG "Labeled Ability" (p. 26): a stunned identity's labeled ability is cancelled, costs paid | Steel Fist (32008)                                      | The "to" half (effect, not cost) is already pinned: `colossus/events.test.ts` "Steel Fist (32008)" (four tests). The **(attack) label** is new, `colossus/qa.test.ts`: unstunned control passes; the stunned case was `it.fails` (bug 1), now a plain `it`                                                                                           | **Fixed in b5d7e726**                  |
| Erratum p. 68, Armor Up (#10): "When the villain would activate, change to hero form" ("would" added)                                                                                                                                                                                                                    | Armor Up (32010)                                        | Already: `colossus/events.test.ts` "Armor Up (32010)" (offered when the villain would activate, alter-ego only)                                                                                                                                                                                                                                      | Pass                                   |
| FAQ "Powerful Punch (#14)", p. 63: Shadowcat flips her mass form as soon as the punch's damage is dealt (she must if Phased), then defends the villain's attack; Phased takes no damage from it                                                                                                                          | Powerful Punch (32014), Solid / Phased                  | Solid half already: `shadowcat/e2e.test.ts` "Powerful Punch (FAQ #14 ...)" and `precon-player-cards.test.ts` "Powerful Punch (32014)". Phased half new, `shadowcat/qa.test.ts`: started Phased, the forced flip to Solid precedes the villain's damage, so she takes it; control started Solid with the optional flip declined                       | Pass                                   |
| FAQ "Mutant Protectors (#17)", p. 63: the ally becomes the defender; if it leaves play before damage, the hero defends (not a basic defense)                                                                                                                                                                             | Mutant Protectors (32017)                               | Known, not re-reported: `precon-player-cards.test.ts` `it.fails` ("announces only the ally as the defender", the hero is also announced as a defender) and `it.todo` for the second half                                                                                                                                                             | Known                                  |
| FAQ "Magik" (hero, p. 64): Mutant Protectors puts an ally into play, it is not played                                                                                                                                                                                                                                    | Mutant Protectors                                       | Already: `precon-player-cards.test.ts` (`cardPlayed` is the Protectors alone). Magik herself is not in the pool yet                                                                                                                                                                                                                                  | Pass                                   |
| FAQ "White Queen (#56)", p. 63: "you are confused" is a continuous constant; a thwart spends the confused card and she gives another; when she leaves play the card stays                                                                                                                                                | White Queen (32056)                                     | Already: `shadowcat/obligation-nemesis.test.ts` "a thwart spends the confused card and she gives another at once" and "when she leaves play the confused card stays"                                                                                                                                                                                 | Pass                                   |
| Ruling Jul 9, 2026 (1): redirecting an attack with Powerful Punch does not satisfy "initiated against you" (Spider-Sense)                                                                                                                                                                                                | Powerful Punch                                          | Already: `precon-player-cards.test.ts` "Powerful Punch (32014) when another player is attacked"                                                                                                                                                                                                                                                      | Pass                                   |
| Ruling Jan 26, 2026 (6) #2: limits apply to cards and persist across flips (a Sam Wilson example)                                                                                                                                                                                                                        | Kitty Pryde's Phase Control (once per round)            | Already: `shadowcat/identity.test.ts` "is limited to once per round, and the limit stays with the card across hero/alter-ego flips"                                                                                                                                                                                                                  | Pass (by analogy; the ruling is Sam's) |
| Ruling Jan 17, 2026 (3) #1: "Effects that 'prevent damage' prevent damage taken, not dealt ... an attack with Piercing that still deals damage to her will remove that Tough status card" (Bulletproof Belle)                                                                                                            | Shadow and Steel (32021, 32050), Colossus's tough cards | New, `colossus/qa.test.ts`: the Juggernaut boost gives the attack piercing (control passes); Shadow and Steel fully prevents the damage but the tough card is **not** discarded: **`it.fails`** (bug 2). Control without piercing passes                                                                                                             | **Fail (pinned)**                      |
| RRG "Tough" (p. 44): a hero defending reduces damage by DEF first; "If the damage is reduced to 0, the hero does not lose their tough status card"                                                                                                                                                                       | Colossus                                                | New, `colossus/qa.test.ts`: defended Rhino attack (ATK 2, DEF 2) keeps the tough card; the undefended control spends it                                                                                                                                                                                                                              | Pass                                   |
| Ruling Jan 26, 2026 (3) and RRG "Overkill" (p. 31), "Tough" (p. 44): overkill counts damage taken; a tough card means no damage taken                                                                                                                                                                                    | Made of Rage (32007)                                    | New, `colossus/qa.test.ts`: the +6 ATK attack on a Hydra Mercenary with a tough card passes no overkill to the villain; no-tough control passes the excess                                                                                                                                                                                           | Pass                                   |
| RRG "Toughness" (p. 44), "Stalwart" (p. 42), "Tough" (p. 44)                                                                                                                                                                                                                                                             | Juggernaut (32026) against Steel Fist                   | New, `colossus/qa.test.ts`: Juggernaut enters play with a tough card; Steel Fist's 5 damage is absorbed (none taken) and Stalwart refuses the stun and confuse                                                                                                                                                                                       | Pass                                   |
| RRG "Permanent" (p. 32): permanent cards are not valid targets for another set's effects; "that effect instead targets the non-permanent card that fits its criteria"                                                                                                                                                    | Solid / Phased (32031), Standard treachery 01188        | New, `shadowcat/qa.test.ts`: with only the mass form to discard it stays and 01188 gains surge; with Acute Control attached that upgrade is discarded and the mass form stays                                                                                                                                                                        | Pass                                   |
| MC32 rulebook p. 3 "Additional Forms" and RRG "Form, Change Form" (p. 21): an additional form change "does count as changing forms for the purpose of triggering card effects such as Ready to Rumble"                                                                                                                   | Solid / Phased, Ready to Rumble (32051)                 | The "does not spend the flip" half already: `shadowcat/identity.test.ts` "her flips never spend the hero/alter-ego once-per-round change". The trigger half new, `shadowcat/qa.test.ts`: her attack's flip to Phased offers Ready to Rumble and readies the hero; declined flip, no offer                                                            | Pass                                   |
| RRG Appendix I "Player Decks" (p. 50): permanent cards are not counted in the 40 to 50 deck size                                                                                                                                                                                                                         | Solid / Phased                                          | Engine level already: `engine/src/deck.test.ts`. New, `shadowcat/qa.test.ts`: her real precon (41 listed, 40 counted) is legal, dropping one counted card is exactly `deck_size` ("39")                                                                                                                                                              | Pass                                   |
| Q49 (docs/phase7-wave6.md §4.1) and RRG "Reveal" (p. 38): Permanently Phased's own When Revealed flip resolves despite its "cannot change mass form"; Q15 = B and RRG "Permanent" (p. 32): set aside before setup step 1                                                                                                 | Permanently Phased (32055), Kitty Pryde Setup           | Already: `shadowcat/obligation-nemesis.test.ts` "When Revealed: the mass form upgrade flips from Solid to Phased" (the constant is already in force) and "when already Phased"; `shadowcat/identity.test.ts` "32030b.setup"                                                                                                                          | Pass                                   |
| Errata p. 65 to 69, other entries; post-1.7 rulings other than the above                                                                                                                                                                                                                                                 | n/a                                                     | No other entry names a card of either hero, their nemesis sets or the shared precon cards. Ruling Mar 19, 2026 (1) (Phased Out, "Hero Action" attachments) is a Vision card; Phase Strike (32038) prints "Hero Action" or "Hero Response" and needs no change. FAQ "Unstoppable Force (#6)" is a different card from the nemesis Unstoppable (32028) | n/a                                    |

## 2. Whole games (new)

Seeds are the first match of a deterministic search over 1..40, so a given run always finds the same game. Every game is
played from setup by the greedy driver, replayed with `replay(log)` and the final state compared with `toEqual`. **No game
was staged by surgery**: the driver reaches both signature mechanics unaided.

| Game               | Variants                                           | What the game must contain (asserted from the replayed events)                                                                                | Result |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Colossus vs Rhino  | 2 players standard (with Shadowcat), 1 hero expert | A tough card given to Colossus (`statusGiven`: Steel Skin, Perseverance or Organic Steel) and a tough card removed from him (`statusRemoved`) | Pass   |
| Shadowcat vs Rhino | 2 players standard (with Colossus), 1 hero expert  | Her mass form changed to Phased and later back to Solid (`formChanged`, `change: "additional"`, `formName` Phased then Solid)                 | Pass   |

The older `e2e.test.ts` files in each hero folder already played solo, 2-player and expert games to an outcome and scripted
the kit (two tough cards with Iron Will and Organic Steel against a piercing attack, Steel Fist, Homesick, a Juggernaut
reveal; Phased defending, Toe to Toe, Powerful Punch, Permanently Phased, White Queen, Shadow and Steel). The new games
add the signature-mechanic assertions and a second wave 6 hero in the 2-player seat. The greedy driver never wins unaided,
so these games end in a loss; the outcome is only required to exist.

## 3. Findings

Two bugs, both pinned with `it.fails` (the test passes while the bug exists and fails, prompting removal of `.fails`, once it
is fixed). Neither was fixed here.

### Bug 1 (fixed in b5d7e726): Steel Fist has no (attack) label (RRG 1.8 errata p. 68; owner `ability-scripting-engineer`, data by `card-data-pipeline`)

- **Source:** erratum p. 68 reads "Hero Action (attack): Deal 5 damage to an enemy. You may discard a tough status card from
  your hero to stun and confuse that enemy." RRG "Labeled Ability" (p. 26): a labeled ability's identity is "considered to
  be performing the labeled effect"; with a stunned identity "the entire ability (except for its costs) is canceled" and
  the status card is removed. Ruling April 30, 2026 (2) #2: a stun met at that point is discarded "instead of dealing damage".
- **Repro:** `colossus/qa.test.ts` "stunned: the ability is cancelled (cost paid), the stun card is removed and no damage is
  dealt" (`it.fails`). Colossus in hero form with a stunned status card plays Steel Fist.
- **Expected:** Steel Fist spent (cost paid), the stunned card removed, the enemy takes 0 damage.
- **Actual:** the enemy takes 5 damage and the stunned card stays (the card is played as plain damage, not an attack).
- **Fixed in b5d7e726:** a curation correction restores the "(attack)" label MarvelCDB drops (the print and the erratum both have it; the erratum only swaps the arrow for "to"), an errata entry records the arrow, and `events.ts` scripts `{ label: "attack" }` with `attackAnEnemy(5)`.
- **Cause:** card data `32008` prints "Hero Action:" with no "(attack)" in `text.printed` / `text.current`, and
  `colossus/events.ts` scripts `heroAction(...)` with no `{ label: "attack" }`; its docblock reads Steel Fist as "plain
  damage, not an attack (no label, so no Overkill, Retaliate ...)". `docs/phase7-wave6.md` §1.9 says "Steel Fist 32008 ...
  raw is already current", which this erratum contradicts. Other consequences of the missing label (not tested): "after you
  attack" responses do not hear Steel Fist. The fix is data (add "(attack)") plus `{ label: "attack" }` on the ability; Shadowcat Surprise
  (`shadowcat/events.ts`, `heroAction({ label: "attack" }, ...)`) shows the shape.

### Bug 2: a piercing attack against a fully prevented attack leaves the tough card (Ruling Jan 17, 2026 (3) #1; owner `game-rules-architect`)

- **Source:** "Effects that 'prevent damage' prevent damage taken, not dealt. If Rogue plays Bulletproof Belle and gains a
  Tough status card, an attack with Piercing that still deals damage to her will remove that Tough status card." RRG
  "Piercing" (p. 32): discards tough cards "before dealing damage"; it does not when the attack "would deal no damage".
- **Repro:** `colossus/qa.test.ts` "#1: Shadow and Steel prevents damage taken, not dealt, so a piercing attack still
  discards the tough card" (`it.fails`). Colossus (hero form, 1 tough card) and Shadowcat; Juggernaut is Rhino's boost card
  (piercing, overkill); Colossus plays Shadow and Steel (32021) when Rhino attacks. A control test (same boost, no Shadow and
  Steel) shows the piercing works: the tough card is removed with reason `piercing` and the damage lands.
- **Expected:** all damage prevented (taken 0), the attack still dealt damage, so the tough card is discarded (0 left).
- **Actual:** damage taken 0 (correct) but the tough card is still there (1 left).
- **Cause (suspected):** Shadow and Steel's `modifyAttack({ preventAllDamage: true })` makes the attack deal 0, which trips
  piercing's "would deal no damage" exception. The ruling says prevention acts on damage taken. The same shape applies to
  every `preventAllDamage` card (Shadow and Steel's docblock names Mockingbird's), so the fix is in the engine's attack damage step.
  The ruling's exact case is Bulletproof Belle, so applying it to Shadow and Steel is by analogy.

### Known, not re-reported

- FAQ "Mutant Protectors (#17)": the hero is also announced as a defender (`it.fails`), and the "ally leaves play before
  damage" half is an `it.todo` (`precon-player-cards.test.ts`).
- The "take damage" cost bug (RRG p. 14; `mojo/qa.test.ts`) was not re-reported; Colossus pays no such cost.
- Titanium Muscles (32005) was known-skipped; scripted in 00c29eb5 (`statusCount`, `generatesAmount`).

### Open questions (taken to the user, nothing pinned)

- **Organic Steel against piercing (Q5).** Piercing discards both tough cards, Organic Steel answers the discard by giving a
  tough card, and the damage still lands on Colossus (asserted by `colossus/e2e.test.ts`: tough 1 left and damage taken).
  Piercing is "Before this attack deals damage ... discard each tough status card"; a card given in response to that
  discard is on the character when the damage is then dealt, so under the Tough rule (p. 44) it could absorb the same
  damage. No ruling or FAQ covers it. The engine follows the Q5 default (one shared response window). Needs an FFG answer
  or a user decision.
- **Shadowcat's flip back after Powerful Punch started Phased.** The FAQ says she "can flip her mass form as soon as the
  damage is dealt (she must do so if she is in Phased mass form)". Started Phased, the forced flip leaves her Solid; whether
  the new Solid face's "after you attack" Response may then flip her back to Phased for the same attack is not stated
  (`shadowcat/identity.test.ts` pins that it hears nothing of that same attack). The new test is written so that either
  reading passes: it declines every optional flip.
- **Unstoppable's printed text** (`32028`) in card data has no "+2 ATK" sentence, though `statModifiers: { atk: 2 }` applies
  it (a Hydra Mercenary with it attacks with ATK 3). If the scan prints that sentence, `card-data-pipeline` should restore
  it to `text`; unverified here.

Not checked (thin coverage, said plainly):

- Piercing's "would deal no damage" exception (p. 32) is not tested with Colossus: no staging produces an unstopped attack of
  0 damage (Unstoppable adds +2 ATK, so DEF 2 no longer cancels a Hydra Mercenary's attack). The engine-level tests cover it
  generically.
- A card-by-card audit of both kits against their scans: the module tests cover each card; this pass read only the cards
  that rulings, FAQ entries and errata name.
- Defensive Energy, Bait and Switch, Perseverance, Aggressive Energy, Lockheed, Kitty's Room, Quick Shift, Toe to Toe,
  Airwalk, Hellfire Club, Hellfire Pawn, Telepathic Restraint, Slammed, Rampaging Juggernaut and Homesick have no ruling,
  FAQ entry or erratum, so no QA test cites one; their behavior is covered only by the module tests.
- Pending defaults Q15 to Q25 were built as recorded and not re-opened.

## 4. Test record

- `cd packages/cards && pnpm exec vitest run src/wave6/mut_gen/colossus/qa.test.ts src/wave6/mut_gen/shadowcat/qa.test.ts`:
  18 passed and 2 expected-fail (`it.fails`: Steel Fist's label, Shadow and Steel against piercing), about 13 s.
- `pnpm --filter @mc/cards exec tsc -p tsconfig.json --noEmit`: clean. `oxlint` and `oxfmt` on both test files: clean.
