# Phase 7 wave 6 rules-QA pass: Gambit and Rogue (`gambit`, `rogue`)

`rules-qa-engineer`, 2026-10-03. Scope: the two hero packs (Gambit / Remy LeBeau 37001 with his kit, the Assassins Guild
nemesis set and the Exodus modular set; Rogue / Anna Marie 38001 with Touched, the Mystique nemesis set and the Reavers
modular set) against RRG 1.8 (FAQ p. 55 to 64, errata p. 65 to 69) and the post-1.7 rulings. Tests:
`packages/cards/src/wave6/gambit/qa.test.ts` and `packages/cards/src/wave6/rogue/qa.test.ts`; no non-test code was
touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` and `marvel-champions-rulings-post-rrg-1-7.md` for Gambit, Remy, Rogue,
Anna Marie, Touched, Med Lab, Exodus, Reavers, Bonebreaker, Mystique, Energy Transfer, Superpower, Royal Flush, Throw de
Card, Charged Card, Skin Contact, Psionic Shield, Bulletproof Belle, Jacket and every card title of both packs, then
every ruling that names a keyword these cards use (Piercing, Overkill, Tough, Quickstrike, Retaliate, Teamwork, Team-Up,
"cannot take damage", "after [enemy] attacks you", prevent).

### Gambit pack

| Source                                                                                                                                                                                           | Card                                     | Where it is pinned                                                                                                                                                                                                                                   | Result |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Erratum RRG p. 68, Psionic Shield (#34): "When attached minion would leave play, instead heal all damage from that minion. Then, discard this attachment." (removed "and put it back into play") | Psionic Shield, Exodus                   | Already: `gambit/exodus/index.test.ts` "37034.psionic-shield-forced-interrupt" (heal, Shield discarded, the next defeat removes him). New, `gambit/qa.test.ts`: nothing re-enters (no second reveal or When Revealed) and a status card on him stays | Pass   |
| Erratum RRG p. 69, Exodus (#28)                                                                                                                                                                  | none                                     | Names the Magneto Hero Pack's Exodus, not 37032 (the Gambit pack's modular minion); no test                                                                                                                                                          | n/a    |
| Ruling Dec 17, 2025 (3): "after [enemy] attacks you" means the player, so it also triggers when that player's ally is attacked                                                                   | Bishop (37011)                           | Already: `gambit/support-upgrades-allies.test.ts` "Bishop: an attack on your ally still counts (the player is attacked)"                                                                                                                             | Pass   |
| Ruling Dec 17, 2025 (3): "when ... attacks" (no "you") abilities are not limited to attacks on you (Flash Freeze is, by its own "you")                                                           | Gambit's Staff (37004)                   | Already: `support-upgrades-allies.test.ts` "Gambit's Staff: also answers a minion's attack"                                                                                                                                                          | Pass   |
| FAQ p. 56 (General), RRG "Tough" p. 44: a hero keeps a tough status card when a basic defense's DEF reduces the damage dealt to 0, loses it to any interrupt-reduced damage                      | Natural Agility (37008)                  | New: with 1 counter held DEF is 3 + 2 = 5 against ATK 5, no damage and the tough card stays; declined, the tough card absorbs the 2 and is discarded. By analogy: no ruling names Natural Agility, see section 4                                     | Pass   |
| RRG "Overkill" p. 31, "Piercing" p. 32, "Tough" p. 44; FAQ p. 56 (tough prevents overkill's excess)                                                                                              | Charged Card (37006), Toughness minion   | New: a 3 HP minion with a tough card: 3 thrown (piercing, overkill) is defeated and 4 goes to the villain; 2 thrown defeats it with no excess; 1 thrown (ranged only) is absorbed by the tough card, nothing defeated, nothing to the villain        | Pass   |
| Q27 (decided, docs section 4.1): Throw de Card adds to each Royal Flush instance, Royal Flush's own counter is placed after Throw de Card pays; card text for Charged Card's thresholds          | Throw de Card, Royal Flush, Charged Card | Already, one play at a time: `gambit/events.test.ts` "Charged Card (37006)", "Royal Flush (37007)". New: one turn with four plays (3 thrown, Royal Flush with none to throw, declined, 1 thrown) so nothing a play wrote leaks into the next         | Pass   |
| RRG "Team-Up" p. 43: both named friendly characters in play, identity or ally, by title or subtitle                                                                                              | Beauty and the Thief (37019)             | Already: refused without Rogue, played with the Rogue ally (37002). New: Rogue as the other player's hero in hero form satisfies it with no ally; in alter-ego form (Anna Marie) it is refused                                                       | Pass   |
| Ruling Feb 28, 2026 (1) #2: abilities triggered by an ongoing attack (responses, Retaliate) resolve before a newly initiated attack begins                                                       | Assassination Attempt, Guild Assassin    | New: two Guild Assassins attack in turn; the first one's Forced Response (it defeated an ally) places its threat before the second attack resolves                                                                                                   | Pass   |
| Ruling Feb 28, 2026 (4) #2 (Quickstrike resolves before When Revealed)                                                                                                                           | Belladonna, Guild Assassin (Quickstrike) | Neither has a When Revealed, so the order is unobservable; Belladonna's reveal and attack are pinned in `gambit/obligation-nemesis.test.ts`                                                                                                          | n/a    |
| Ruling Jan 17, 2026 (3) (Piercing), Mar 6, 2026 (1) (prevent is damage taken)                                                                                                                    | Charged Card, Natural Agility            | The Piercing half is Charged Card's, pinned above (2 thrown discards the tough card first); no Gambit card prevents damage                                                                                                                           | Pass   |

### Rogue pack

| Source                                                                                                                                                                            | Card                                                 | Where it is pinned                                                                                                                                                                                                                                  | Result   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Erratum RRG p. 69, Anna Marie (#1A): "Setup: Find your Touched upgrade and set it aside. Withdrawn: After you change to this form, find Touched and set it aside."                | Anna Marie                                           | Already: `rogue/rogue/identity.test.ts` "38001b.setup", "38001b.withdrawn" (3 tests)                                                                                                                                                                | Pass     |
| Erratum p. 69, Rogue (#1B) and Energy Transfer (#7): "Find Touched and attach it to ..."                                                                                          | Skin Contact, Energy Transfer                        | Already: `identity.test.ts` "38001a.skin-contact" (hand, already attached elsewhere), `events.test.ts` "Energy Transfer (38007)" (set aside, hand, moving). New: Touched in Rogue's discard pile is found (RRG "Find" p. 19)                        | Pass     |
| Erratum p. 69, Mystique's Manipulations (#26): "The defeating player searches ..."                                                                                                | Mystique's Manipulations                             | Already: `obligation-nemesis.test.ts` "38026.when-defeated" (2 players, the defeating player; a set-aside Misled is not found)                                                                                                                      | Pass     |
| Erratum p. 69, Bonebreaker (#31): Forced Interrupt becomes Forced Response                                                                                                        | Bonebreaker                                          | Already: `reavers/index.test.ts` "38031.bonebreaker-forced-response" (1 and 2 Reavers engaged). New: Donald Pierce reveals him; with Pierce engaged the count is 2 and his teamwork activates once                                                  | Pass     |
| Erratum p. 69, Rogue (#12) and ruling Jan 17, 2026 (1) (Hope Summers' star icons)                                                                                                 | none                                                 | The Nightcrawler Hero Pack's Rogue ally, not a card of this pack                                                                                                                                                                                    | n/a      |
| Ruling Jan 17, 2026 (3) #1: "prevent damage" prevents damage taken, not dealt; "an attack with Piercing that still deals damage to her will remove that Tough status card"        | Bulletproof Belle                                    | Plain attacker already: `events.test.ts` "Bulletproof Belle (38008)". New: Senyaka (piercing) against a Belle: Rogue takes no damage (passes); the piercing attack does not remove the tough card Belle gave: **bug, `it.fails`, section 3**        | **Fail** |
| RRG "Tough" p. 44 ("not considered to have taken damage"), FAQ p. 56 (DEF to 0 keeps the card)                                                                                    | Not Today! (38016) with a tough status card          | New: DEF + 2 reduces the attack to 0, the card stays and 2 threat comes off; DEF + 2 not enough, the card absorbs the rest, still "no damage taken", 2 threat comes off; control without the event: card used, no threat                            | Pass     |
| Ruling Dec 17, 2025 (2) (Not Today! gives +2 DEF; a hero's DEF still exists when not used)                                                                                        | Not Today!                                           | The ruling's cases need Side Step or Stop Hitting Yourself, neither in this pool; Not Today!'s +2 DEF and threat removal are pinned in `events.test.ts`                                                                                             | n/a      |
| Ruling Jan 26, 2026 (1) (a cost with damage and another effect is valid on a target that cannot take damage); RRG "Prevent" p. 35 (dealing damage as a cost is paid if prevented) | Energy Transfer, Cybernetic Enhancements (38035)     | Tough host already: `events.test.ts` "the 2 damage is a cost: a tough card on the host stops it". New: Wade Cole with Cybernetic Enhancements (cannot take damage): Touched attaches, the 2 damage is prevented (`cannotTakeDamage`), Rogue heals 2 | Pass     |
| Ruling Mar 19, 2026 (2) (a basic attack cannot target a character that cannot take damage)                                                                                        | Cybernetic Enhancements                              | Already: `reavers/index.test.ts` "38035.cybernetic-enhancements-constant-2" (`no_valid_target`)                                                                                                                                                     | Pass     |
| RRG "Ownership and Control" p. 31 (upgrade on another player's card is controlled by that player; owner decision 2026-10-03)                                                      | Touched, Skin Contact                                | Already: `identity.test.ts` "Hero in a 2-player game: Touched on P2's hero is controlled by P2". New: Touched left there through a round change (Rogue in alter-ego form), found and moved by the next round's Skin Contact                         | Pass     |
| RRG "Ownership and Control" p. 31 (Q29): a played event goes to its owner's discard pile                                                                                          | Superpower Adaptation                                | Already: `events.test.ts` "the card stays P2's: played by Rogue, it goes to P2's discard pile, not hers" (and the owner unchanged in hand)                                                                                                          | Pass     |
| RRG "Team-Up" p. 43                                                                                                                                                               | Beauty and the Thief (38020)                         | New: Gambit as the other player's hero in hero form satisfies it with no ally; in alter-ego form it is refused                                                                                                                                      | Pass     |
| Erratum p. 68, Psionic Shield, RRG "Leaves Play" p. 27 (attached cards are discarded when the card leaves play)                                                                   | Touched, Exodus (Gambit's set)                       | New: Touched on Exodus survives the first defeat (the Shield replaces his leaving play); the second defeat sends it to Rogue's discard pile                                                                                                         | Pass     |
| Q28 (decided: copied traits live while Touched stays), RRG "Find" p. 19                                                                                                           | Rogue's Jacket, Belle, Skin Contact, Energy Transfer | New: one turn, Skin Contact onto an ally then Energy Transfer onto a minion: one Touched, the Jacket's +1 THW becomes +1 ATK, the ally's traits are gone and the minion's are in, and Belle is offered only for the minion's attack                 | Pass     |
| Ruling Dec 17, 2025 (4) #2: Med Lab takes an ally from a discard pile, never one removed from the game                                                                            | Med Lab (38028)                                      | Med Lab is unscripted pending a tucked-count value (known, not re-reported); no test until it is scripted                                                                                                                                           | n/a      |

No other erratum on p. 65 to 69, FAQ entry or post-1.7 ruling names a card of either pack.

## 2. Whole games (new)

Seeds are the first match of a deterministic search over 1..60, so a given run always finds the same game. Every game is
played from setup by the greedy driver, replayed with `replay(log)` and the final state compared with `toEqual`. The
second hero is Cyclops in Gambit's 2-player game and Gambit in Rogue's. No game is staged.

| Game                    | Variants                                         | What the game must contain (asserted from the replayed events)                                                                          | Staged? |
| ----------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Gambit vs Rhino         | 2 players standard (with Cyclops), 1 hero expert | Charge de Card and Throw de Card both resolved, and a `charge` counter added                                                            | No      |
| Gambit vs Rhino, Exodus | 2 players standard (with Cyclops)                | Any ability of the set resolved (`3703[2-5]`: Exodus's When Revealed, Herald of Avalon, Psionic Shield or Acolyte Frenzy)               | No      |
| Rogue vs Rhino          | 2 players standard (with Gambit), 1 hero expert  | Skin Contact and Rogue's player phase Forced Response (Touched found and set aside) both resolved                                       | No      |
| Rogue vs Rhino, Reavers | 2 players standard (with Gambit)                 | Any ability of the set resolved (`38029` to `38035`: a Reaver's Forced Response or When Revealed, The Reavers, Cybernetic Enhancements) | No      |

The greedy driver reaches every signature mechanic unaided (Throw de Card and Skin Contact are `useAbility` / trigger
choices it makes), so none of the games needed surgery. No game wins (the greedy driver ends in a loss, as in the other
passes); an outcome is only required to exist. The older `e2e.test.ts` files already played each pack's solo, 2-player
(with Wolverine) and Core-hero modular games.

## 3. Findings

**Bug, pinned with `it.fails` (owner: `game-rules-architect`): a piercing attack that Bulletproof Belle prevents does not
discard the tough status card Belle gave.**

- Ruling Jan 17, 2026 (3) #1 (Alex Werner): "Effects that 'prevent damage' prevent damage taken, not dealt. If Rogue plays
  Bulletproof Belle and gains a Tough status card, an attack with Piercing that still deals damage to her will remove
  that Tough status card." RRG "Piercing" (p. 32) exempts only an attack that "would deal no damage".
- Repro (`rogue/qa.test.ts`, "Senyaka's piercing attack discards the tough card Belle just gave", `it.fails`): Rogue in
  hero form, Senyaka (32161, a minion whose attacks gain piercing) engaged, Touched put on him with Skin Contact, the
  villain stunned, Bulletproof Belle in hand; end the turn and play Belle when Senyaka attacks. Actual: `statusGiven
tough`, `attackResolved { baseAtk: 3, damageDealt: 3 }`, `damagePrevented { amount: 3, reason: "effect" }`, and no
  `statusRemoved`; Rogue keeps the tough card (the next treachery's damage then uses it). Expected: a `statusRemoved
tough` between the prevention and the end of the attack.
- Cause: `packages/engine/src/resolve/event.ts` (~line 877 to 915), the `preventedByAttackFlag` and `damagePreventerOf`
  branches return before `pierceTough` runs; the code's own comment calls this an "UNCONFIRMED READING" and says no cycle
  1 card reaches it. Belle is the first card that does, and the ruling settles it. The same ruling's #2 (keywords have
  timing priority over triggered abilities, Aerial Evacuation) is the same fix and is not a card of these packs.
- The companion test (`Senyaka's piercing attack deals damage that Belle prevents: Rogue takes none`) passes today and
  must keep passing after the fix. When the fix lands, delete the `it.fails` wrapper.

**Flagged conflict, owner-decided, not a bug report: Teamwork resolves before When Revealed (Q2) against RRG 1.8 p. 43.**
RRG p. 43 ("Teamwork (Trait)"): "If a minion with the teamwork keyword is being revealed, the teamwork keyword resolves
after any 'When Revealed' abilities on that minion are resolved." The owner chose the opposite for Q2 (docs section 4.1:
before, "like quickstrike", by ruling Feb 28, 2026 (4) #2), and `reavers/index.test.ts` pins that order. The ruling names
Quickstrike only and is dated before RRG 1.8 (July 2026), which restates the teamwork order in the same entry. The Reavers
make the difference visible: Wade Cole and Murray Reese reveal with a When Revealed that attaches Cybernetic Enhancements
(+1 ATK, cannot take damage, discarded after the minion attacks). With the RRG order a teamwork attack by Wade has ATK 3 and
spends the attachment; with Q2's order it has ATK 2 and the attachment survives until his next attack. Not changed here;
taken to the user as a decision to confirm against the RRG text.

Open questions, no authoritative source found, so nothing is pinned (said plainly):

- **Psionic Shield and "defeated".** Exodus is at 0 hit points, the Shield heals him and he never leaves play. Whether
  Stealth Strike's "if that enemy is defeated by this attack" (37014), War Room's "after an ally ... defeats a minion"
  (37030) and Overkill's excess (RRG p. 31) see that as a defeat has no ruling. The erratum text ("would leave play, instead
  heal") suggests the character is defeated and the defeat is replaced, but nothing says so. Untested.
- **Bulletproof Belle on an attack against another player.** Its text has no "you" ("When an enemy with Touched attached to
  it attacks"), so by ruling Dec 17, 2025 (3) it is not limited to attacks on Rogue; what "prevent all damage from that
  attack" and the defense label then do for a hero who is not the target is unspecified. Untested (the second player's attack
  was not probed with a second Belle).
- **Natural Agility against a tough status card.** The test uses FAQ p. 56 and RRG p. 44 by analogy: the +DEF is made in the
  "when you defend" window, so it is part of the DEF the defense applies, not an interrupt that reduces damage afterwards.
  If FFG rules the other way (the interrupt is too late and the card must be spent), the "with 1 counter held" test is the one
  to change.

Not checked (thin coverage, said plainly):

- A card-by-card audit of the two packs against their scans: the module tests cover each card, this pass read only the cards
  that rulings, errata and interactions name.
- Med Lab (38028) and Misled (38027's stay-in-hand outside a Mystique game) are known and being fixed; no test here depends on
  them. Bishop's all-counters interrupt is now scripted and its module tests pass.
- Thief Extraordinaire, The Thieves Guild, Operative Skill, Dazzler, Iceman, Karma, Judoka Skill, Moira MacTaggert, X-Gene,
  Mutant Education, X-Men Instruction and the Guild Business obligation have no ruling or FAQ entry, so no QA test cites one;
  their behavior is covered only by the module tests.
- The Reavers' Skullbuster, Murray Reese and The Reavers side scheme and the Exodus set's Herald of Avalon and Acolyte Frenzy
  likewise have only module tests (and the games above, which only prove that some card of the set resolved).

## 4. Test record

- `cd packages/cards && pnpm exec vitest run src/wave6/gambit/qa.test.ts src/wave6/rogue/qa.test.ts`: 31 passed and 1
  expected fail (15 Gambit; 16 Rogue plus the `it.fails` pin), about 50 s while other agents were running.
- `pnpm --filter @mc/cards exec tsc -p tsconfig.json --noEmit`, `pnpm exec oxlint` and `pnpm exec oxfmt --check` on both files:
  clean.
