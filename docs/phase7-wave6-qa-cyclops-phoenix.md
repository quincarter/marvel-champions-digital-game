# Phase 7 wave 6 rules-QA pass: Cyclops and Phoenix (`cyclops`, `phoenix`)

`rules-qa-engineer`, 2026-10-03. Scope: the two hero packs (Cyclops / Scott Summers 33001 with his kit, Lost Visor and
the Mister Sinister set; Phoenix / Jean Grey 34001 with Phoenix Force, Burning Hunger and the Dark Phoenix set) against
RRG 1.8 (FAQ p. 55 to 64, errata p. 65 to 69) and the post-1.7 rulings. Tests: `packages/cards/src/wave6/cyclops/qa.test.ts`
and `packages/cards/src/wave6/phoenix/qa.test.ts`; no non-test code was touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` and `marvel-champions-rulings-post-rrg-1-7.md` for the hero names, Jean
Grey, Scott Summers, Phoenix Force, power counters, Restrained/Unleashed and every card title in both packs (Cyclops
pack: Exploit Weakness, Practiced Defense, Priority Target, Field Commander, Ruby Quartz Visor, Full Blast, Ricochet
Beam, Coordinated Attack, Marked, Befuddle, Pinned Down, Lost Visor, Mister Sinister, Gene Therapy and so on; Phoenix
pack: Psychic Rapport, Psychic Manipulation, Rise from the Ashes, Burning Hunger, Dark Phoenix, Consume the World, Fiery
Rage and so on).

| Source                                                                                              | Card                                                 | Where it is pinned                                                                                                                                                                                                     | Result |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| FAQ "Ricochet Beam (#9)", RRG p. 64: Exploit Weakness on the same enemy for both instances, 8 total | Ricochet Beam, Exploit Weakness                      | Already: `cyclops/cyclops/events.test.ts` "FAQ #9 ...", and 4 + 8 through `sessionApply` in `cyclops/cyclops/e2e.test.ts`                                                                                              | Pass   |
| Ruling Feb 8, 2026 (1): Coordinated Attack, designer intent over rules as written (Q50 = A)         | Coordinated Attack                                   | Already: `cyclops/cyclops/support-upgrades-allies.test.ts` "an attack that defeats the attached minion still takes 1 less consequential damage" with three controls. RAW and intent disagree; the build follows intent | Pass   |
| RRG "Temporary" (p. 44)                                                                             | Exploit Weakness, Practiced Defense, Priority Target | Exploit Weakness: `e2e.test.ts` (already). All three at once: new, `cyclops/qa.test.ts`                                                                                                                                | Pass   |
| Ruling Jan 26, 2026 (3): overkill counts damage taken; Marked with 0 taken gives no overkill        | Marked (33032)                                       | Taken-and-excess half already pinned (`support-upgrades-allies.test.ts` "Marked (33032)"). The dealt-but-not-taken half (tough card on the Marked minion) is new, `cyclops/qa.test.ts`, with a no-tough control        | Pass   |
| Ruling Jul 9, 2026 (3) #5: "Peril prohibits other players from acting or playing cards"             | Fiery Rage (34031, prints Peril)                     | New, `phoenix/qa.test.ts`: the card carries the peril keyword the engine reads (`perilOnStack`, `ctx.ts`). The sole-decider mark itself is the engine's, pinned in `keywords.test.ts`                                  | Pass   |
| Errata p. 65 to 69                                                                                  | none                                                 | No entry names a card of either pack. Logan's Setup (p. 68) is the wording Q25 copies for Jean Grey's Setup: a decision, not an erratum for her. Her Setup is pinned in `phoenix/phoenix/identity.test.ts`             | n/a    |
| Ruling Jul 9, 2026 (3) #1 (alter-ego Setup always resolves after a setup form change)               | Jean Grey's Setup                                    | Names Stryfe II only; no test written (nothing in the Phoenix pack changes form during setup)                                                                                                                          | n/a    |

Other post-1.7 rulings that name a card of these packs: none. Rulings that name Aggressive Energy, Berserker Barrage,
Logan or Wolverine's Claws belong to the Wolverine pack's pass.

## 2. Whole games (new)

Seeds are the first match of a deterministic search over a fixed range (1..40 Cyclops, 1..60 Phoenix), so a given run
always finds the same game. Every game is played from setup by the greedy driver, replayed with `replay(log)` and the
final state compared with `toEqual`. **No game was staged by surgery**: the driver reaches every signature mechanic.

| Game                            | Variants                                                                               | What the game must contain (asserted from the replayed events)                                                                                        | Result |
| ------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Cyclops vs Rhino                | 2 players standard (with Phoenix, the pack that shares Psychic Rapport), 1 hero expert | A Temporary tactic upgrade played (33005/6/7), Optic Blast resolved (`33001a.cyclops-constant`, which needs an enemy with an upgrade), an ally played | Pass   |
| Phoenix vs Rhino, Phoenix Force | 2 players standard (with Wolverine), 1 hero expert                                     | A power counter placed on Phoenix Force and Phoenix Force flipped                                                                                     | Pass   |
| Phoenix vs Rhino, Dark Phoenix  | 2 players standard (with Wolverine), 1 hero expert                                     | `34029.when-revealed` resolved and Dark Phoenix schemed onto Consume the World (`schemeResolved` with a Consume the World instance as scheme)         | Pass   |

The older `e2e.test.ts` files already played each pack's solo, 2-player and expert games to an outcome; these add the
signature-mechanic assertions and a second wave 6 hero in the 2-player seat. Neither pack's games win (the greedy driver
never wins unaided), they end in a loss; the outcome is only required to exist.

## 3. Findings

No bug found in this pass. No `it.fails` was needed. The known "take damage" cost bug (RRG p. 14; `mojo/qa.test.ts`) was
not re-reported.

Not checked (thin coverage, said plainly):

- A card-by-card audit of the two packs against their scans: the module tests cover each card, this pass read only
  the cards that rulings name. The card-data fixes listed in `phase7-wave6.md` §6.1 (Fiery Rage's text, the Cyclops ally's
  Forced Interrupt) are `card-data-pipeline`'s and were not re-verified here beyond Fiery Rage's keyword.
- Peril's "other players cannot act" is not testable at engine level beyond the `soleDecider` mark; in the staging
  tried (Fiery Rage dealt with Dark Phoenix in play, two players) the reveal raised no prompt, so no mark was observed on
  a Fiery Rage prompt. The keyword assertion is the whole of that check.
- Pending defaults Q16 to Q25 were built as recorded and not re-opened; Q15/Q25 (permanent cards set aside before
  setup) remain the cross-wave follow-up.
- Full Blast, Ruby Quartz Visor, Pinned Down, Befuddle, Psychic Misdirection and Rise from the Ashes have no ruling or
  FAQ entry, so no QA test cites one; their behaviour is covered only by the module tests.

## 4. Test record

- `cd packages/cards && pnpm exec vitest run src/wave6/cyclops/qa.test.ts src/wave6/phoenix/qa.test.ts`: 10 passed
  (5 Cyclops, 5 Phoenix), about 60 s.
