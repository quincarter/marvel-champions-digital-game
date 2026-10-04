# Wave 6 QA playthrough A: Colossus, Shadowcat, Wolverine, Mutant Genesis campaign

Branch `feature/wave-6` (PR 94). 2026-10-04. Headless Chromium (`--use-angle=metal`), real mouse clicks and keys, the
Vite dev server on a clean clone (port 5211), URL `?unlock=all`. State was read through the dev hooks and the store
only, never changed. Games went through the real screens (New game, Scenario select, Take your seats, Set the table,
Deal it out) for the first game of each hero, the two-hero tables and the campaign; later games of a hero started
through the same `store.start` call Table setup makes (the e2e `startGame` shape) so a seed that deals the wanted card
could be used. Screenshots: the scratchpad folder `qa-a-10644/shots/` (279 files, named
`<hero>-<scenario>-<NN>-<what>.png`, plus `camp-*`, `camp2-*`, `camp3-*`, `ph-*` for the phone and campaign runs; the
scratchpad is session-local, so the file names below are the pointer).

## What was played

| Hero / table                          | Scenario                    | Viewport | Rounds                                                                                                                             |
| ------------------------------------- | --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Colossus                              | Sabretooth, standard        | 1440x900 | 3 (seed 34508 via Set the table), then a second game (seed 17) to a loss in round 4                                                |
| Colossus                              | Magneto, expert             | 1440x900 | 4 (lost in round 4; an earlier seed lost in round 3)                                                                               |
| Colossus                              | Sabretooth, standard        | 390x844  | round 1 plus the villain phase up to the ally-defends prompt (flip, Iron Will, tabs, payment)                                      |
| Shadowcat                             | Project Wideawake, standard | 1440x900 | 4 (lost in round 4, Operation Zero Tolerance), then "Run it back" and a fresh round 1                                              |
| Shadowcat                             | Mansion Attack, standard    | 1440x900 | 4 (no loss; Avalanche still up, 5 damage)                                                                                          |
| Shadowcat                             | Project Wideawake, standard | 390x844  | board, identity sheet only                                                                                                         |
| Wolverine                             | Master Mold, standard       | 1440x900 | 2 (lost in round 2); three shorter reruns for Claws, Barrage, Jubilee, Lunging Strike                                              |
| Wolverine                             | Sabretooth, expert          | 1440x900 | 4 (lost in round 4, Robert Kelly)                                                                                                  |
| Wolverine                             | Master Mold, standard       | 390x844  | board, flip, Claws panel                                                                                                           |
| Colossus + Shadowcat                  | Sabretooth, standard        | 1440x900 | 2 (conflict sheet on Play, replace one and keep one, Team-Up ring and splash, Shadow and Steel played)                             |
| Colossus + Wolverine                  | Master Mold, standard       | 1440x900 | 1 (Fastball Special played)                                                                                                        |
| Mutant Genesis (Colossus + Shadowcat) | issue #1 Sabretooth         | 1440x900 | issue #1 round 2 (side scheme defeated, main scheme advanced to The Injured Senator); a second run conceded in round 1 and rewound |
| Mutant Genesis                        | roster, briefing            | 390x844  | cover, roster, conflict sheet, picker, opener, role choice, role-building                                                          |

Not reached: issue #2's briefing and the campaign log between issues (neither game won issue #1; rewind was used
instead). Not a four-round game: Wolverine vs Master Mold (the heuristic player died in round 2), Colossus + Shadowcat
and Colossus + Wolverine (two rounds and one round). Never exercised: Inspect's Team-Up alert text, Made of Rage,
Quick Shift, Phased "cannot take damage while defending", Berserker Barrage's repeat with a tough card or a damage
cost that is partly prevented, Sunfire, Healing Factor with real damage on a Wolverine round start (it was offered and
declined), the MC campaign Dossier.

## Defects

| id   | where                                                                                | what I did                                                                                         | expected (cite)                                                                                                                                                                                                                                                                                | actual                                                                                                                                                                                                                                                                 | severity   | screenshot                                                           | owner     | status                                                                                                              |
| ---- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| A-1  | Colossus vs Sabretooth, standard, round 2, 1440x900                                  | Colossus in alter-ego form; End turn; played Armor Up on the villain's activation, took Steel Skin | Armor Up (32010, erratum RRG 1.8 p. 68 "Added would"): "When the villain would activate, change to hero form." RRG 1.8 "Activation" (p. 6): a villain activating against a hero-form identity attacks it. The form is read after the interrupt, so Sabretooth attacks Colossus (tough absorbs) | He flipped to hero form, then Sabretooth still SCHEMED (event `enemyActivated` activation "scheme", then `schemeResolved`, 6 threat placed). The activation kind is fixed in `activateEnemy` before `enemyActivating` is announced and `continueActivation` replays it | wrong rule | `colossus-sabretooth-24-armorup-prompt.png`, `-25-after-armorup.png` | engine    | open; pinned by `it.fails` in `packages/cards/src/wave6/mut_gen/colossus/qa-playthrough-a.test.ts`                  |
| A-2  | Wolverine's Claws, Inspect on the card (Master Mold, 1440x900 and 390x844)           | Flipped to hero form, opened Wolverine's Claws                                                     | The action button names a computed cost without a figure: "Exhaust, take damage" (card: "take damage equal to its printed cost")                                                                                                                                                               | Button read "WOLVERINE'S CLAWS — EXHAUST, TAKE [OBJECT OBJECT] DAMAGE" (a value spec printed as a number); also on the on-card strip                                                                                                                                   | UI defect  | `wolv1-02-claws-inspect.png`, fixed: `wolv2-05-claws-fixed.png`      | client    | fixed in 8cce53df, with a Vitest case                                                                               |
| A-3  | "Run it back" after a loss, then Inspect on the identity card (Shadowcat, Wideawake) | Lost in round 4, pressed Run it back, kept the hand, right-clicked Kitty Pryde                     | Inspect's "This card, this game" lists only this game's beats (the table log already starts over on a rematch)                                                                                                                                                                                 | The list opened with the previous game's lines ("4.04 Shadowcat defends...", "... 25 earlier") on a game that was at round 1 beat 1                                                                                                                                    | UI defect  | `shadowcat2-01-inspect-after-runitback.png`                          | client    | fixed in 4769dcf7 (card history reset in `Board.create`, next to the log reset)                                     |
| A-4  | Take your seats, a filled seat's clear button (1440x900)                             | Picked Colossus                                                                                    | A short control label is never cut with an ellipsis (owner UI rules); the 16px clear button shows its cross                                                                                                                                                                                    | The button drew "✕…" (label fitted to a 0px budget, so it was clipped)                                                                                                                                                                                                 | polish     | `colossus-sabretooth-03-seated.png`, fixed: `fixcheck-seats.png`     | client    | fixed in 3082ff40                                                                                                   |
| A-5  | Shared `McButton` value column (Attack with / Thwart with source bar, 1440x900)      | Opened the Attack-with picker in Wolverine + Jubilee and Colossus + Professor X tables             | A button's right-hand value ("ATK 3") sits inside the button                                                                                                                                                                                                                                   | The value was centered on a point 16px from the right edge, so a three-character value ran past the button's edge by a few px; now right-aligned, 12px inset                                                                                                           | polish     | `wolv3-08-attack-pick.png` (after)                                   | client    | fixed in 3082ff40 (judged from code and the picker; the "before" crop was not captured)                             |
| A-6  | Small stat badge ribbon (THW, ATK, DEF; allies at small sizes)                       | Read the code path after a crop of the thwart bar showed a cut label I could not confirm           | The stat name is never cut with an ellipsis                                                                                                                                                                                                                                                    | `fitText` falls to an ellipsis ("TH…") when the ribbon (94% of a small badge) is narrower than the name at the smallest caption size; not seen on any shipped panel in these games                                                                                     | polish     | none                                                                 | client    | defensive fix in 3082ff40 (ribbon widens to the label); not reproduced                                              |
| A-7  | Project Wideawake, standard, round 4 loss (Shadowcat) on the **old** clone           | Four cards under Operation Zero Tolerance (3 + 1 hero), the scheme's constant ended the game       | Game over names Operation Zero Tolerance (its text: "the players lose the game"), not the main scheme                                                                                                                                                                                          | Game over read "THE SCHEME WINS", final blow "NIGHT OF THE SENTINELS HIT 0 THREAT", reason `mainSchemeCompleted`; the cause was `endGame("loss")` on the side scheme                                                                                                   | UI defect  | `shadowcat1-27-gameover.png`                                         | engine    | very likely fixed by b1cecd46 (card-scripted loss records `cardAbility` with the source); re-verify on current HEAD |
| A-8  | Colossus / Piotr Rasputin, alter-ego flip (Homesick, flip back)                      | Flipped to alter-ego with no Colossus card in the discard pile (only basic cards)                  | Aspiring Artist (32001b): "shuffle a Colossus card from your discard pile into your deck" is not offered with nothing to shuffle, or is offered but says there is nothing to pick                                                                                                              | The trigger sheet "Piotr Rasputin: trigger an ability?" is offered, accepting resolves with no effect and no message                                                                                                                                                   | polish     | `colossus-sabretooth-21-homesick2.png`                               | scripting | open                                                                                                                |
| A-9  | Phone (390x844) Saga shelf                                                           | Opened Campaign                                                                                    | The volume list shows the picked volume without a scroll on a phone, or the list is clearly scrollable                                                                                                                                                                                         | The list is clipped to four rows under a tall featured tile; Mutant Genesis (vol. 5) needs a wheel scroll in the list (not the page) to reach; no scroll hint                                                                                                          | polish     | `ph-camp-01-saga.png`, `ph-camp-02-saga-vol5.png`                    | client    | open                                                                                                                |
| A-10 | Phone (390x844) payment strip                                                        | Played Iron Will; the strip shows 4 of 7 hand cards                                                | Every card that can pay is reachable                                                                                                                                                                                                                                                           | The remaining cards scroll sideways with no hint; the one card I needed (Energy) was off screen until I scrolled the strip with the wheel                                                                                                                              | polish     | `ph-colossus-13-paid.png`, `ph-colossus-13b-scrolled.png`            | client    | open                                                                                                                |

## Verified OK

Colossus (Sabretooth standard, Magneto expert, phone, two-hero)

- Setup puts Organic Steel in hand (seed 34508 and the campaign deal offered "choose 1 of 2" Organic Steel copies).
- Flip to hero gives Steel Skin and, with Perseverance, a second tough card: two tough cards on one hero (limit 2) and
  the panel shows "TOUGH" once with the right count after Bulletproof Protector (2 given from 1 discarded).
- Titanium Muscles pays with the tough count: 1 tough made 1 physical; Inspect says "Can be used as a resource in hero
  form while you pay for a card: exhaust it to generate 1 physical for each tough status card on Colossus (now: 1)" and
  the payment sheet lists it as "ability:..titanium-muscles-resource".
- Steel Fist (5 damage; optional discard of a tough card stuns and confuses; the tough card went away; the stun was
  spent by the villain's next attack and the confuse stayed). Iron Will's response drew a card after a tough discard,
  including a discard by piercing. Organic Steel's response gave a new tough card, used one counter and exhausted.
- Piercing attack against tough (Sabretooth with Adamantium Claws): the tough card was discarded by piercing and the
  damage landed (2 after DEF 2). Tough prevents a whole hit from ATK 2 + 3 boost (5) and loses one card.
- Basic attack (tough on the villain absorbs 2), thwart (the picker lists both schemes; the main scheme is greyed with
  "a crisis icon blocks thwarting the main scheme"), recover/flip, Armor Up and Powerful Punch defense windows, Mutant
  Protectors putting Shadowcat in as the defender (phone, two-hero).
- Homesick (both choices), Juggernaut/Unstoppable not drawn.
- Shadow and Steel with Shadowcat seated: TEAM-UP tag over the card in hand, played in the villain phase for 2, all
  damage prevented and 4 dealt to Sabretooth (`damagePrevented` 3, villain 8 to 7 damage).
- Expert Magneto: stage II 20 HP, TOUGH, magnet counters placed after each attack on the main scheme, Boarding Party and
  three M-Type Sentinels in round 3.

Shadowcat (Wideawake, Mansion Attack, phone, two-hero)

- Setup puts the mass-form upgrade into play Solid; Phase Control flips it to Phased (once per round); a basic attack or a
  defense in Solid mass form offers the Solid response, which flips it to Phased (and Phased flips back as a forced
  response). Lockheed, Kitty's Room (draw in Phased, heal in Solid text matches), Ready to Rumble readying after a flip,
  Shadowcat Surprise, Phase Strike, Airwalk all resolved as written.
- Captive ally rescue in Wideawake: defeating Abduction Protocols with a basic thwart moved Cannonball under the first
  player's control. Operation Zero Tolerance took Lockheed under it when an attack defeated him, the main scheme's
  forced response put the top card of the deck there and removed 5 threat per hero; the loss came with 4 cards.
- Mansion Attack: stage order shuffled (`stageOrder` 0,1,3,2,4), Avalanche with TOUGH, Victory 2 and "exhaust an ally"
  prompt, Save the School environment in play, the villain's ATK and HP read right.
- Mixed table: the "Cards that can't be played" sheet on Play lists Colossus's own Shadowcat ally (Keep only, no
  Replace) and the basic Colossus ally in Shadowcat's deck (Replace or Keep); the picker leads with a recommended ally
  (Agent 13); Continue stays inert until both are answered; the sheet appears only on Sign & open issue #1 in the
  campaign roster (no standing notice).

Wolverine (Master Mold, Sabretooth expert, phone, two-hero)

- Claws put into play at setup; Claws asked for an attack event, took damage equal to its printed cost (2 for Berserker
  Barrage), and the event's damage went to the chosen minion. Barrage: defeated a Sentinel, offered "Take 2 damage to
  repeat this ability" and repeated on the villain (Tough absorbed). Healing Factor offered at each player phase start.
- Lunging Strike, Precision Strike, Warrior Skill (Interrupt on attack, counters shown, used and declined), Jubilee
  (choose-an-enemy response, then Jubilee and Magneto in the "Attack with" picker with their consequential damage notes),
  Master Mold's Sentinel guard text, the expert Sabretooth stage II (HP 15, TOUGH) and Robert Kelly loss in round 4.
- Fastball Special (Colossus and Wolverine): 6 damage (3 + 3 with upgrades), defeated a minion and the excess hit the
  villain through its tough card.

Mutant Genesis campaign (desktop and phone)

- Saga shelf to cover (title, blurb, "Expert campaign: Finish standard to unlock"), roster pre-filled Colossus and
  Shadowcat with a TEAM-UP badge on both seats and the pair label, no conflict notice, Sign & open issue #1 opens the
  sheet, replace/keep, opener comic (4 beats, Back and Skip), briefing (the briefer's line, role cards with aspects and a
  one-line description, "What roles do"), role confirm (explains upgrades and role-building in the picked role's own
  words), the second hero skips the role already taken ("TAKEN . SEAT 1 . COLOSSUS"), role-building picker with a
  Recommended shelf, card pictures, Inspect with TAKE THIS CARD, a confirm step, then an upgrade step, the "Handled for
  you" list (role taken, role upgrade drawn, role-building result), deck counts, Open issue #1. Issue #1 setup revealed
  Frightened Police (6 threat), the game started with Ferocious Attack and Coup de Grace in play and Organic Steel
  chosen at setup. Playing it: defeating Find the Senator advanced to The Injured Senator with the order prompt, Robert
  Kelly joined the first player's play area, Protect the Senator entered. Concede then Continue led to the Rewind screen
  (new shuffle, same hands, edit decks, shelve), and Rewind returned to the briefing.

## Notes for the owners

- A-1 changes who gets hit: in a two-hero game an alter-ego player who plays Armor Up would otherwise lose the point of
  the card. The fix is in `packages/engine/src/villain/phase.ts` (decide attack-or-scheme after `enemyActivating`).
- The conflict sheet text "Colossus's own card · can only be spent as a resource" and the table-rule line "Hero and ally
  of one name" read correctly; nothing to file.
- Console and page errors: none during the games. One run threw `fadeEffect` of undefined from
  `ui/transitions.ts:154` (via `scenes/boot.ts:583`) after the dev server restarted under the page with a hot reload;
  I could not reproduce it on a fresh load, so it is not filed.
