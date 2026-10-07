# Damage dealt versus damage taken: the audit of every damage trigger

Owner ruling 2026-10-07 (`docs/phase7-wave7.md` section 4.1): "after X deals / is dealt damage" fires once the attack
or effect reached the damage-dealing process, whether or not the target then took any of it. RRG 1.8 "Prevent" (p. 35):
"the amount of damage that character 'takes' is reduced, but the amount of damage 'dealt' is not reduced"; "Tough"
(p. 44) prevents the same way. "After X takes / suffers damage", "attacks and damages" and "damage is placed here" still
need damage placed on the target.

## The rule as built

A resolved `dealDamage` event carries both amounts (`packages/engine/src/trigger-events.ts`):

| Field    | Meaning                                                                                              | After tough | After a full prevention | After a constant to 0 | After "cannot take damage" | 0 as dealt |
| -------- | ---------------------------------------------------------------------------------------------------- | ----------- | ----------------------- | --------------------- | -------------------------- | ---------- |
| `dealt`  | The amount as the damage was dealt: before any "prevent" interrupt, after any "increase that damage" | N           | N                       | N                     | N                          | no event   |
| `taken`  | The damage placed on the target (always equal to the event's `amount` result)                        | 0           | 0                       | 0                     | 0                          | no event   |
| `amount` | What was left to take once the interrupts had run (unchanged meaning)                                | N           | 0                       | N                     | N                          | 0          |

- A response reads one of the two, and the validator refuses a damage response that names neither:
  `on.damage(who, { dealt: true | N })` (`eventAtLeast: { dealt: N }`) or `on.damage(who, { taken: true })`
  (`requireResults: { amount: 1 }`). `on.youDealDamage` reads `dealt`; `on.consequentialDamage` reads taken.
- A response window (and a lasting "each time" effect) opens when `dealt` is positive. Before this change a
  prevention interrupt that took `amount` to 0 closed it, while a tough status card did not.
- An interrupt reads the pending `amount`, as before: once a prevention has taken it to 0 no further interrupt is
  gathered. Interrupt order ("would be dealt" and "would take", status cards first) is unchanged.
- Damage that is 0 as it would be dealt (0 ATK, a defense that covers the attack, X = 0) opens no window, is neither
  dealt nor taken, and spends no tough status card (owner ruling 2026-10-06, unchanged).
- Attack-level wording is unchanged and reads damage taken: "attacks and damages" and "if this attack deals damage
  to" read the attack's `damage` result.

Tests: `packages/engine/src/dealt-vs-taken.test.ts`, `packages/engine/src/zero-damage-no-window.test.ts`, and with
real cards `packages/cards/src/wave7/rulings-2026-10-06-part2.qa.test.ts` section 4b.

## Responses (22 abilities on 21 cards)

"Changed" is whether the script's reading or behavior moved with this ruling.

| Card   | Name                     | Printed phrase                                                                            | Reading | Changed                                                                                                      |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| 16032  | Schadenfreude            | each time you deal any amount of damage to an enemy                                       | dealt   | Yes: now also heals when a prevention interrupt stopped all of it (it already did after tough)               |
| 16149  | Power Stone              | After a hero or villain deals 3 or more damage to attached character with a single attack | dealt   | Yes: read `amount` (after prevention); now moves after a full or partial prevention when 3 or more was dealt |
| 19028  | Challenge Accepted       | After Drax deals 4 or more damage to attached enemy with a single attack                  | dealt   | Yes: as Power Stone, at 4                                                                                    |
| 01152  | Vibranium Armor          | After the villain takes damage                                                            | taken   | No                                                                                                           |
| 08030  | Counterattack            | After you take damage from an enemy attack                                                | taken   | No                                                                                                           |
| 19012  | Martyr                   | After Martyr takes consequential damage from performing an attack                         | taken   | No                                                                                                           |
| 20028  | Shake it Off             | After a guardian character takes any amount of damage from an attack                      | taken   | No                                                                                                           |
| 21100a | Avengers Tower           | After damage is placed here                                                               | taken   | No                                                                                                           |
| 21100b | Avengers Tower (Damaged) | After damage is placed here                                                               | taken   | No                                                                                                           |
| 27078  | "Now We're Angry!"       | After Venom takes any amount of damage from an attack                                     | taken   | No                                                                                                           |
| 27080  | Lashing Out              | After Venom takes any amount of damage from an attack                                     | taken   | No                                                                                                           |
| 27081  | Tooth and Nail           | After Venom takes any amount of damage from an attack                                     | taken   | No                                                                                                           |
| 27165  | Violent Tendencies       | After attached villain takes any amount of damage from an attack                          | taken   | No                                                                                                           |
| 30001a | Spider-Ham               | After Spider-Ham takes any amount of damage                                               | taken   | No                                                                                                           |
| 31035  | Sandman                  | After Sandman takes any amount of damage from an attack                                   | taken   | No                                                                                                           |
| 35005  | Berserker Frenzy         | After Wolverine takes any amount of damage from an enemy attack                           | taken   | No                                                                                                           |
| 40169  | Mental Transferal        | After Stryfe takes any amount of damage                                                   | taken   | No                                                                                                           |
| 42026  | Hook, Line, and Sinker   | After a friendly character takes any amount of indirect damage                            | taken   | No                                                                                                           |
| 43001a | X-23                     | After X-23 takes any amount of damage                                                     | taken   | No                                                                                                           |
| 43003  | Honey Badger             | After Honey Badger takes any amount of damage                                             | taken   | No                                                                                                           |
| 43036  | Front Line Specialist    | After your identity takes damage from an enemy attack                                     | taken   | No                                                                                                           |
| 44034  | Involuntary Procedures   | After Deadpool takes any amount of damage                                                 | taken   | No                                                                                                           |

Counts: 3 dealt, 19 taken (18 cards, Avengers Tower on both sides), 3 changed.

Not changed, and worth a look by whoever owns the cards: three "takes" responses read the event's `amount` inside
their effect, which is the damage left after the interrupts and not reduced by a constant or a cap. Counterattack 08030
("an equal amount") and Lashing Out 27080 / Tooth and Nail 27081 ("an equal amount of threat") would read the damage
taken more exactly as `eventResult("amount")`, as Mental Transferal does. Violent Tendencies 27165 ("if that attack
dealt 3 or more damage to attached villain") reads the same `amount`; whether that clause is damage dealt or damage
taken is attack-level wording and was left as built.

## Interrupts (64 abilities): the pending amount, neither reading

Every one is a "would take / would be dealt / would deal" interrupt, or a replacement worded as one. An interrupt
resolves before anything is dealt or taken, so the split does not apply and none changed.

| Card   | Name                             | Printed phrase                                                                                                                                              |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01003  | Backflip                         | When you would take any amount of damage from an attack, prevent all of that damage                                                                         |
| 01017  | Cosmic Flight                    | When Captain Marvel would take damage                                                                                                                       |
| 01098  | Armored Rhino Suit               | When any amount of damage would be dealt to Rhino                                                                                                           |
| 02001a | Norman Osborn                    | When Norman Osborn would take any amount of damage                                                                                                          |
| 02002a | Norman Osborn (II)               | When Norman Osborn would take any amount of damage                                                                                                          |
| 02003a | Norman Osborn (III)              | When Norman Osborn would take any amount of damage                                                                                                          |
| 03005  | Shield Block                     | When you would take any amount of damage                                                                                                                    |
| 04065  | Crossbones' Armor                | When Crossbones would take any amount of damage                                                                                                             |
| 04104  | Photographic Reflexes            | when a player attacks Taskmaster, prevent all damage that would be dealt to Taskmaster and deal an equal amount of damage to that player's identity instead |
| 05005  | Wiggle Room                      | When you would take any amount of damage, prevent 3 of that damage                                                                                          |
| 05017  | Energy Barrier                   | When you would take any amount of damage                                                                                                                    |
| 08032  | Defensive Stance                 | When you would take any amount of damage                                                                                                                    |
| 09021  | Warning                          | When a hero would take any amount of damage                                                                                                                 |
| 11014  | Temporal Shield                  | When Kang is attacked … prevent all damage from this attack                                                                                                 |
| 13009  | Bio-Synthetic Wings              | When you would take any amount of damage                                                                                                                    |
| 14015  | Side Step                        | When you would take any amount of damage, prevent 3 of that damage                                                                                          |
| 14027  | Vibration Resistance             | Reduce the damage attached enemy takes from each attack by 1                                                                                                |
| 15008  | Magic Shield                     | When a friendly character would take any amount of damage                                                                                                   |
| 16001a | Groot                            | When Groot would take any amount of damage                                                                                                                  |
| 16012  | Starhawk                         | When Starhawk takes damage exactly equal to his remaining hit points                                                                                        |
| 16052  | Booster Boots                    | When you would take any amount of damage from an attack                                                                                                     |
| 16074  | Biogram Image                    | When Collector would take any amount of damage                                                                                                              |
| 16153  | In Defiance                      | When an identity would take any amount of damage from an attack, prevent 2 of that damage                                                                   |
| 16162  | Armor Plating                    | When an identity would take any amount of damage                                                                                                            |
| 17006  | Bad Boy                          | Hero Interrupt When you would take any amount of damage from the villain's attack                                                                           |
| 17008  | Jet Boots                        | When Star-Lord would take any amount of damage                                                                                                              |
| 18004  | Crosscounter                     | When you would take any amount of damage, prevent 3 of that damage                                                                                          |
| 19006  | Parry                            | When you would take any amount of damage, prevent X of that damage                                                                                          |
| 19015  | Deflection                       | When an identity would take any amount of damage from an attack, prevent up to 5 of that damage                                                             |
| 21061  | Shield Spell                     | When you would take any amount of damage from an attack                                                                                                     |
| 21173  | Master of Illusions              | When Loki would take damage from an attack                                                                                                                  |
| 23034  | Stand Together                   | When a friendly character would take any amount of damage from an attack                                                                                    |
| 24014  | Beast Mode                       | When a stunned or confused friendly character would take any amount of damage                                                                               |
| 24024  | Controller                       | When Controller's attack would deal any amount of damage to a character                                                                                     |
| 24033  | Self-Experimentation             | When a Brute enemy would take any amount of damage                                                                                                          |
| 24039  | Jetpack                          | When attached minion would take any amount of damage from an attack                                                                                         |
| 26014  | Protector                        | When Protector would take any amount of damage                                                                                                              |
| 26019  | Side Step                        | When you would take any amount of damage, prevent 3 of that damage                                                                                          |
| 27014  | Jump Flip                        | When you would take any amount of damage, prevent 2 of that damage                                                                                          |
| 27044  | Field Agent                      | ally would take any amount of consequential damage                                                                                                          |
| 27066  | Sand Form                        | When you would deal any amount of damage to Sandman                                                                                                         |
| 27077a | Bell Tower                       | When any amount of damage would be dealt to Venom by an attack                                                                                              |
| 27077b | Bell Tower (Ringing)             | When Venom's attack would deal any amount of damage to an identity                                                                                          |
| 27090  | Masterful Mirage                 | Forced Interrupt When you would deal any amount of damage to Mysterio                                                                                       |
| 27183b | Impact-Dampening Suit (Enhanced) | When your hero would take any amount of damage from an enemy attack                                                                                         |
| 28003  | Forcefield Projection            | When a friendly character would take any amount of damage from an attack, prevent 3 of that damage                                                          |
| 30009  | Cartoon Physics                  | When your identity would take any amount of damage                                                                                                          |
| 31018  | Energy Barrier                   | When you would take any amount of damage                                                                                                                    |
| 31019  | Forcefield Generator             | When you would take any amount of damage                                                                                                                    |
| 32011  | Nightcrawler                     | When an X-MEN character would take any amount of damage from an enemy attack                                                                                |
| 32066  | Robert Kelly                     | When an enemy resolves an undefended attack against you, deal that damage to Robert Kelly                                                                   |
| 32149  | Magnetic Bubble                  | When Magneto would take any amount of damage                                                                                                                |
| 34007  | Telekinetic Shield               | When attached character would take damage from an enemy attack, place that damage here instead                                                              |
| 39028  | Stinger Tail                     | When any amount of damage would be dealt to Mojo                                                                                                            |
| 39031  | Undercover Mojo                  | When Mojo would take any amount of damage                                                                                                                   |
| 39066  | Wild Wild Mojo                   | When a character takes damage, increase that damage by 1                                                                                                    |
| 40012  | Telekinetic Force Field          | When a friendly character would take any amount of damage                                                                                                   |
| 40034  | Telekinetic Force Field          | When attached character would take any amount of damage, prevent that damage                                                                                |
| 40106  | Hidden in the Clutter            | When any amount of damage would be dealt to attached enemy                                                                                                  |
| 40144  | Sinister Disguise                | When a player would deal damage to Mister Sinister                                                                                                          |
| 41006  | Psionic Redirect                 | When you would take any amount of damage from an enemy attack, prevent 2 of that damage                                                                     |
| 42014  | Aerial Intervention              | When a character would take any amount of damage from an attack                                                                                             |
| 42020  | Cannonball                       | When Cannonball would take any amount of consequential damage                                                                                               |
| 44017  | Barely a Scratch                 | When you would take any amount of damage from an attack, prevent 1 of that damage for each [crisis]                                                         |
