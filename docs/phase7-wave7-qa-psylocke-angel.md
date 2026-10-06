# Phase 7 wave 7 rules-QA pass: Psylocke and Angel (cards 41001-41033 and 42001-42032)

`rules-qa-engineer`, 2026-10-05. Scope: the two hero packs (identity, hero events, supports / upgrades / allies,
obligation and nemesis sets, and each pack's aspect and basic cards) against RRG 1.8 and the post-1.7 rulings. Test file:
`packages/cards/src/wave7/psylocke/qa-psylocke-angel.qa.test.ts` (62 tests, about 35 s). No non-test code was touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` (page numbers are the end-of-page numbers in the Markdown) and
`marvel-champions-rulings-post-rrg-1-7.md` for Psylocke, Angel, Archangel, Concussive Blow and Team-Up. **No ruling names a card of
either hero** (the one hit for "Concussive Blow" is Drax's Concussive Bombs, December 17, 2025 - Ruling 3, unrelated). The rules
used are general:

| Source                                                              | Used for                                                                                                                                                       | Where pinned                                                                                   | Result |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| RRG "Labeled Ability" (p. 26), "Stun, Stunned" (p. 41)              | A stunned or confused hero using a labeled event or upgrade ability: canceled whole, costs paid, status removed; a canceled attack or thwart is not "attacked" | "Stunned and confused heroes ...", "A stunned or confused hero's canceled ...", "Upgrade ..."  | Pass   |
| Ruling August 13, 2026 - Ruling 1                                   | A stunned Archangel's Razor Dive was still "played": Angel of Death answers                                                                                    | "stunned Archangel: Razor Dive is canceled, yet Angel of Death ..."                            | Pass   |
| RRG "Retaliate X" (p. 38), "Consequential Damage" (p. 13)           | Retaliate and consequential damage are not "damage from an attack": Psionic Redirect and Aerial Intervention are not offered                                   | "Retaliate damage is not an enemy attack"                                                      | Pass   |
| RRG "Form, Change Form" (p. 21); ruling January 26, 2026 - Ruling 6 | A form change keeps damage, statuses, exhaustion and attachments; an effect-caused change does not spend the voluntary one; limits persist across flips        | "Angel's three faces ...", "Regrowth's limit ..."                                              | Pass   |
| RRG "Team-Up" (p. 43), "Form" (p. 21)                               | Soaring Hearts needs both named characters in their hero faces; an alter-ego Betsy is not "Psylocke"                                                           | "Soaring Hearts (Team-Up ...) across the two seats"                                            | Pass   |
| RRG "Exhausted" (p. 19), "Player Phase" (p. 34)                     | Exhaust costs on triggered abilities (Aerial Intervention, Eyes in the Sky); identities ready at the end of their own turn, so only a defense leaves one tired | "Avian Anatomy, the once-per-phase faces and Eyes in the Sky", "Retaliate ..." (see section 4) | Pass   |
| RRG "Stun, Stunned" (p. 41): a stunned villain's attack is replaced | Taunt against a stunned Stryfe: stun removed, no damage, the draw of 3 still happens                                                                           | "Taunt (42016) against a stunned villain"                                                      | Pass   |
| RRG "Permanent" (p. 32), "Indirect Damage" (p. 24)                  | A blade never sits in a hand, deck or discard pile while the game goes on; indirect damage is capped per character                                             | Step invariants; the nemesis sweep                                                             | Pass   |
| Ruling January 11, 2026 - Ruling 3                                  | A resource an ability generates is a "printed resource" when paying a cost: Concussive Blow paid with Psi-Katanas deals its 3                                  | "Concussive Blow paid with a Psi-Katana's [physical] resource"                                 | Pass   |
| Q37, Q39 = C, Q40 = B, Q41, Q42 (spec 4.1)                          | Soaring Hearts vs Archangel / Warren / Betsy; Dragon X in the sweep; Illusion; Agility; the face answering                                                     | as above                                                                                       | Pass   |

Owner rulings were applied as written and not re-opened.

## 2. Card-by-card audit against the printed text

Compared the 65 card records (printed text, timing word, label, cost, icons, traits, keywords, limits, play restrictions)
with every script. **No mismatch found.** Checked per card: every `Hero Action` / `Action` / `Alter-Ego Action` / `Interrupt` /
`Hero Interrupt` / `Response` / `Hero Response` / `Forced` word agrees with the builder used; the labels ((attack), (thwart),
(defense)) are on exactly the abilities that print them (Flurry, Psi-Bow, Psi-Flail Strike, Telekinesis, Adaptive Plumage's
two halves, Razor Dive, Mental Detection, Natural Flight, Telepathy; Psionic Redirect and Aerial Agility as defense) and on none
that do not (Concussive Blow's own label is the 05031 reprint's); "once per phase / round" is on Angel of Life / Death and Regrowth
and nowhere else; "Max 1 per player" (Telepathy, Telekinesis, Float, Soaring Acrobatics), "Max 1 per character / side scheme"
(X-Force Recruit, Containment Strategy), Permanent (blades), Restricted (Psi-Katana), Toughness (Warpath), Alliance (Flying
Formation) and Team-Up (Soaring Hearts, both printings) are data. Judgments recorded rather than raised:

- Bombs Away, IPAC, X-Bunker and Apocalyptic Influence print a choice or a deal in their cost list; the scripts choose or deal as the first
  effect. Equivalent (RRG "Target": the cost is not considered when finding a valid target), no finding. The module headers say so.
- Psi-Bow Attack says "your hero has the PSIONIC trait" and is scripted on the current face; as a Hero Action it can only be played in
  hero form, so no observable difference.
- Aerial Intervention says "a character", and the script offers it for damage to enemies as well (it was offered for Stryfe's own damage from
  an ally attack in a probe). That is the printed text, so left as is; flagged only because a player may not expect to protect the villain.
- Psi-Energy Control prints no "you may"; as an Interrupt it is optional (Hero Interrupts are not Forced). No finding.

The card images were not compared to the data (no scans in the repo); the audit is against the ingested printed text.

## 3. What was exercised beyond the precon games

Tests, by group (all in the one file):

- **Stunned and confused.** Psylocke: Flurry of Blades (two Katanas, stunned: canceled whole; confused: not canceled, the confused card
  stays), Mental Detection (confused: no thwart and no Katana draw), Psi-Flail Strike after a defense (stunned: canceled, event paid),
  Psi-Bow Attack, Telekinesis (stunned: exhaust and [mental][mental] paid) and Telepathy (confused: paid, canceled, with a control).
  Angel: Razor Dive and Adaptive Plumage as stunned Archangel, Adaptive Plumage and Natural Flight as confused Angel, Metamorphosis
  as confused Archangel (unlabeled: resolves, the confused card stays through the form change).
- **A canceled attack is not an attack.** Stunned Psylocke's basic attack: Weapons Training's and Upside the Head's responses are not
  offered (with a control showing both offered unstunned); confused basic thwart: Psionic Training not offered.
- **Katana, Directed Force, retaliate.** A Psi-Katana's piercing and +1 ATK do not reach Psi-Bow Attack (a tough Stryfe absorbs it);
  Directed Force on Psi-Bow Attack (ranged, 6) and on Razor Dive as Archangel (8 through a tough card) and not offered to Angel.
  Retaliate damage does not open Psionic Redirect or Aerial Intervention; Elixir's consequential damage does not open Aerial Intervention.
- **Psionic Illusion on an event attack.** Psi-Bow Attack under Illusion: the interrupt fires, the top card is discarded, the 4 damage is
  redirected onto her own identity and the card is discarded; an ally's attack does not trigger it.
- **Concussive Blow paid with two Psi-Katanas.** The [physical] resource counts (3 damage as well as the confuse).
- **Soaring Hearts, both seats.** Refused while the Psylocke player is Betsy Braddock or the Angel player Warren; allowed with both in hero
  face (both identities readied); the search offers the hero set's events only.
- **Angel's three faces.** Damage, all three status cards, exhaustion and an attached upgrade survive Warren to Angel to Archangel to Warren;
  Apocalyptic Influence turns Angel to Archangel in a round where Warren already changed form by choice (with a stunned card kept); Aerial
  Agility as Archangel counts as a defense for Angel's Aerie; Razor Dive returned by Avian Anatomy and replayed: Angel of Death answers once;
  Regrowth used, then Angel and back to Warren through Metamorphosis: a second Regrowth is refused; hand size after a change to Angel is 5.
- **Exhaust costs.** Eyes in the Sky is offered with a ready Angel and neither it nor Aerial Intervention is offered with Angel exhausted from defending
  (Eyes with a control; Intervention's own module tests are the control); Containment Strategy removes 2 threat after a defense whose damage Aerial Intervention (paid by Siryn) fully prevented.
- **Play restrictions across forms.** Pete Wisdom and IPAC (X-FORCE): refused to Betsy Braddock and Warren, allowed to Psylocke, Angel, Archangel.
- **Nemesis and obligations in a two-player game.** All ten cards (Chimera, Interdimensional Plunder, Psionic Illusion, Telekinetic Dragon;
  Harpoon, Hook Line and Sinker, Harpoon's Harpoon, Spear Shot) and both obligations revealed to their own hero (Psylocke seat 1, Angel seat 2) and
  resolved through the end of the round with the first and then the last option at every prompt, whole-state invariants checked at every prompt;
  both obligations stay in their own seat's play area; Telepathic Suggestion canceling Interdimensional Plunder (threat 2 lower) and Body Swapped
  (no flips, obligation still in play).
- **Expert games (3, 14 games).** Psylocke vs Juggernaut (5 seeds), Angel (starting as Angel) vs Mister Sinister (5), Psylocke + Angel vs Morlock
  Siege (4), all `difficulty: "expert"`, played by the greedy driver one command at a time with every state checked (no prompt without an answer, no
  card in two zones or none, no Permanent blade in a hand, deck or discard pile, rounds advance one at a time) and every log replayed to a deep-equal
  final state. Each group requires that its best seed reaches round 3. Hope Summers never defends (a policy, as in the sibling pass).

## 4. Findings

**No new defect found.** The pass produced no `it.fails`. Two probes looked like defects and were not, which is worth recording so nobody
re-files them:

- _Eyes in the Sky and Aerial Intervention paid by an "exhausted" Angel._ A first probe set Angel exhausted before ending the turn and saw
  both interrupts offered and paid. That staging was wrong: identities ready at the end of their own turn (RRG "Player Phase", p. 34), so
  Angel was ready again by the villain phase. Staged properly (Angel exhausted by defending Stryfe's activation first), neither interrupt is offered
  and the tests pass as ordinary tests.
- _Loss in round 1 on Telekinetic Dragon._ In the two-player Juggernaut sweep the Dragon's X (Q39 = C: cards in play, hand, deck and discard
  pile) is large enough to defeat Psylocke's identity and Hope Summers together (indirect damage is capped per character, RRG p. 24), a loss
  by the rules. The sweep accepts a loss for that one card and checks the invariants anyway. This is a consequence of the owner's Q39 = C, not a
  new question.

Known pinned defects in the modules, still standing (not re-pinned here):

| Where                                                                                         | What                                                                                                           | Status                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `psylocke/support-upgrades-allies.test.ts`, Cypher "a confused enemy he defeats still counts" | An attack response reads the target's status after a defeated enemy has left play; no pattern field carries it | `it.fails`, engine gap |
| `angel/support-upgrades-allies.test.ts`, Warpath "the same response in the villain phase"     | Warpath's response does not play the Hero Action event when he defends a minion's attack in the villain phase  | `it.fails`             |
| Excluded by the brief: damaging abilities offer an enemy that cannot take damage              | Flurry of Blades' Katana damage, Psi-Bow, Telekinesis, Razor Dive etc. share `anAttackableEnemy`               | queued elsewhere       |

## 5. Not covered, and confidence

- **Psi-Energy Control on a stunned or confused basic power.** Whether "when you use a basic power" is met when the stun cancels the attack is
  not settled by the RRG text I found (the stun replaces the attack, but the power was used). Not tested; no ruling.
- **Telepathic Suggestion and Surge / Pete Wisdom.** Whether a canceled "When Revealed" still gives a printed Surge (RRG "Surge" says it is
  equivalent to a When Revealed; August 3, 2026 - Ruling 3 is about Enhanced Spider-Sense) and whether Pete Wisdom's "after you resolve" is met
  by a canceled treachery are open. Not tested; worth an FFG question if a player hits it.
- **Psionic Illusion against Psi-Flail Strike** (a response attack by her identity): the redirect target and what "stun it" then stuns are untested.
- **Four-seat and campaign play, the Hope Summers losing condition and the other three Wave 7 heroes** are other slices.
- **Coverage depth.** Every card has a module test and at least one full game; this pass added cross-card and cross-status checks for the
  riskiest 25 or so. The Psylocke ally's response (42002), Siryn, Elixir, Cannonball, Float Like a Butterfly and Soaring Acrobatics have no status-card
  or two-seat interaction test beyond their modules'. A passing suite here is a claim about those interactions, not the whole pool.
- The expert games prove stability (no stall, no stranded card, replay equality), not strategy: the greedy driver loses most expert games early.

## 6. Questions for the owner

None blocking. If a ruling is wanted on the two open items in section 5 (Psi-Energy Control under a stun; Telepathic Suggestion with Surge and
Pete Wisdom), the default recommendation is: Psi-Energy Control is offered (the power was used, the attack was replaced), and a canceled
When Revealed gives no Surge and does not count as "resolved" for Pete Wisdom.
