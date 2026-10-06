# Who "you" is, reader by reader (audit, 2026-10-06)

Owner ruling 2026-10-06 (docs/phase7-wave7.md §4.1, '"You" on obligations and identity attachments'): roll the RRG
reading out to the remaining rule readers by context, with the target, the attack and the resolving player still
deciding where the text is about them.

## What the rules say

- A card a player controls: its controller (RRG 1.8 "You, Your", p. 49).
- An attachment on a player card: "the attached player card's controller" ("Attachment", p. 8).
- An obligation: "the player whose play area the obligation is in" ("Obligation", p. 30).
- An enemy's constant or boost text during its attack: "the defending player" ("Defend, Defense", pp. 14-15); for an
  attack against an ally, "the player who controls the attacked ally" ("Attacks Against Allies", p. 10).
- A When Revealed or Boost ability: the player resolving it ("You, Your").
- A minion's constant text outside an attack: the RRG has no sentence. The engine reads the engaged player.

## The resolver

`speakerOf(state, id)` in `packages/engine/src/select.ts` decides "you" from the card's own state: controller, else
the player the rules name for an uncontrolled card (`uncontrolledYouOf`: the host's controller for an attachment, the
holder for an obligation or an environment in a play area), else the player whose play area the card is in (an engaged
minion). `constantYouOf` adds the victory display (the card's owner, wave 7 §3.50). Text about a context names it with
its own ref and never reaches the resolver: `attackedPlayer`, `eventPlayer`, a chosen target, the ability frame's
controller for a When Revealed or Boost ability.

## Cells

Columns: (a) player card in play, (b) encounter card engaged with a player, (c) attachment on an identity, (d)
attachment on an ally / on a minion, (e) obligation in a play area, (f) ownerless card in the villain's area.
"nobody" means a bare "you" matches no player. Each cell is the state **before** this change; every "wrong" cell now
reads as the "should be" column says.

| Reader                                           | (a)   | (b)                       | (c)           | (d) ally / minion          | (e)           | (f)                       | Should be                                  |
| ------------------------------------------------ | ----- | ------------------------- | ------------- | -------------------------- | ------------- | ------------------------- | ------------------------------------------ |
| Rules already read with the speaker (1)          | right | right                     | right         | right / nobody (2)         | right         | right: nobody             | speaker                                    |
| Rules read with the raw controller (3)           | right | wrong: nobody             | wrong: nobody | wrong: nobody / nobody (2) | wrong: nobody | right: nobody             | speaker                                    |
| `countsAs` rule, granted-Permanent scan          | right | wrong: nobody             | wrong: nobody | wrong: nobody / nobody (2) | wrong: nobody | right: nobody             | speaker                                    |
| A rule's `player` field and `while`              | right | right                     | right         | right / nobody (2)         | right         | right: nobody             | speaker                                    |
| Stat modifiers (hand size included)              | right | wrong: nobody             | right         | right / nobody (2)         | right         | right: nobody             | speaker                                    |
| Keyword grants, trait grants                     | right | wrong: nobody             | right         | right / nobody (2)         | right         | right: nobody             | speaker                                    |
| Cost modifiers                                   | right | right                     | right         | right / nobody (2)         | right         | right: nobody             | speaker                                    |
| `blankTextBox` rule                              | right | right                     | right         | right / nobody (2)         | right         | right: nobody             | speaker                                    |
| A boost card's own boost-icon modifier           | n/a   | n/a                       | n/a           | n/a                        | n/a           | wrong: nobody             | the player the activation resolves against |
| Triggered abilities (pattern, queries, resolver) | right | right: the event's player | right         | right / the event's player | right         | right: the event's player | named player, else the event's (4)         |
| Leaves-play trigger (`cardLeavesPlay.speakerId`) | right | n/a                       | right         | right / nobody             | right         | n/a                       | as it was in play                          |
| Action ability on an uncontrolled card           | right | right: any player         | right         | right / any player         | right         | right: any player         | "Attachment" p. 8, "Action" p. 6           |
| When Revealed, Boost ability                     | n/a   | n/a                       | n/a           | n/a                        | n/a           | right: resolving player   | resolving player                           |
| Lasting rule, modifier or grant                  | right | right                     | right         | right                      | right         | right                     | the creating ability's controller (p. 26)  |
| Scenario rule with no card                       | n/a   | n/a                       | n/a           | n/a                        | n/a           | right: nobody             | nobody                                     |

1. `cannotAttack`, `cannotThwart`, `cannotPlay`, `cannotReady`, `cannotDefend`, `cannotFlip`, `cannotActivate`,
   `ignoreBoost`, `entersPlayExhausted`, `keepsGivingStatus`, `keepsExhausted`, and every reader that only resolves a
   `player` field (`cannotChangeForm`, `cannotRecover`, `repeatWhenRevealed`, `allyLimit`, `restrictedLimit`,
   `takesFirstTurn`, `printedResourceAs`, `deckDiscardIconCount`, `mayLookAtTopOfEncounterDeck`).
2. Open, not changed: an attachment on an engaged minion names no one from its state. The RRG's attachment sentence
   covers player-card hosts only. Scripts name the engaged player (`engagedWith(host)`) or the attacked player.
3. Every other `activeRules` reader matched its queries with the source card's controller, so `controller: "you"`,
   `engagedWith: "you"`, `owner: "you"` and a `you` player ref inside a query named nobody on an uncontrolled card:
   `cannotTakeDamage`, `preventAllDamage`, `reduceDamageTaken`, `increaseDamageTaken`, `doubleDamageTaken`,
   `maxDamageTakenPerAttack`, `maxSustainedDamage`, `cannotBeHealed`, `cannotBeDefeated`, `notDefeatedWithoutThreat`,
   `cannotLeavePlay`, `cannotBeUnattached`, `cannotHaveAttachments`, `cannotHaveStatus`, `statusLimit`,
   `cannotTriggerActions`, `cannotResolveTriggeredAbilities.on`, `cannotBeCanceled`, `threatCannotBeRemoved` (target,
   `exceptBy`), `readyCost.target`, `additionalThwartCost`, `thwartWithAtk`, `basicThwartTargets`, `characterIgnores`,
   `divideBasicPower`, `attackKeywords`, `attacksDealIndirectDamage`, `attacksDividedEvenly`, `excessDamageBonus`,
   `excessDamageAsThreat`, `mustDefendWithAlly`, `gainsIcon`, `excludedFromAllyLimit`,
   `excludedFromPlayerSideSchemeLimit`, `defeatDestination`, `defeatedIntoEncounterDeck`,
   `discardFromPlayDestination`, `schemeThreatDestination`, `accelerationTokenDestination`, `playersCannotDiscard`,
   `firstRevealGainsSurge.cards`, `staysInHand`, `entersRevealersPlayArea`, `leavingPlayLoses`, `focusedMainScheme`,
   `controlledByFirstPlayer`.
4. Deliberately narrower than the constants' reading (`uncontrolledYouOf`): "after you attack this minion" on an
   engaged minion is whoever attacks it, so the event decides for an enemy. Done in e7d086c6; not changed here.

## What changed

`activeRules` builds one context per rule with "you" as the speaker (`ActiveRule.speakerContext` is gone; every reader
uses `ActiveRule.context`). Stat modifiers, keyword grants and trait grants read `constantYouOf`; `countsAs` and the
granted-Permanent scan read `speakerOf`. `boostIconsFor` takes the player the activation resolves against, passed from
the boost step, the icon cancel and the defend preview; outside an activation it is null, as before.

## Left open for the owner

- (d) on a minion, note 2.
- "Defend, Defense" gives an enemy's constant and boost "you" to the **defending** player when another player defends.
  `PlayerRef attackedPlayer` and the Boost ability's resolver keep the player the attack was initiated against (wave 7
  §4.1 Q16). The boost-icon modifier follows the Boost ability, so the two agree with each other; neither was changed.
