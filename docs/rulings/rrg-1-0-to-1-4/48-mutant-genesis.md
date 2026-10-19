# Mutant Genesis

> **Source:** [Hall of Heroes: Official FFG Rulings (RRG 1.0 - 1.4 main page & errata)](https://hallofheroeslcg.com/official-ffg-rulings/#mutant)  
> **Fetched:** 2026-10-18. Transcribed by script from Hall of Heroes; Hall of Heroes is the transcriber, not the authority.  
> **OLDER FFG rulings, tier 4 in CLAUDE.md's rules authority order:** valid only where consistent with RRG v1.8, superseded where v1.8 contradicts them; FFG calls contact-form answers preliminary until a Rules Reference update includes them.  
> **Newer rulings:** [marvel-champions-rulings-post-rrg-1-7.md](../../../marvel-champions-rulings-post-rrg-1-7.md). **Regenerate:** `uv run scripts/scrape_rulings_markdown.py` (do not edit by hand).

---

## Mutant Genesis

> How does the newly revealed “Mutant Protectors” work? This card looks awesome, but it is really confusing us, especially its (defense) label. Mutant Protectors says “Hero Interrupt (defense): When an enemy attacks, put an X-MEN ally into play from your hand. Exhaust it and declare it the defender for this attack.” Does “Defend, Defense” bullet #4 make the player’s identity the defender when that player *begins* resolving a (defense) ability? If so, does bullet 2 prevent Mutant Protectors’ second sentence from successfully resolving? If it doesn’t, why not? Does “Defend, Defense” bullet #4 make the player’s identity the defender when that player *finishes* resolving a (defense) ability? If so, does bullet #3 mean this card is not playable in the first place?
>
> Or does the player’s ID end up the defender after all? Does the (defense) label have any effect? Mutant Protectors does not appear to provide an explicit exception to following normal “defense” rules. It only seems to require such an exception because it has the (defense) label, while the label itself doesn’t seem to have any relevant effect in the normal use of the card. We are really puzzled about why it is there in the first place, if in the normal course of events, it is ignored – but in the unusual situation in which the player has already defended the attack, it is able to override Defense rules and make the ally the defender anyways (but without an explicit exception to defense rules allowing such a thing).
>
> Sorry for the rambling, the short version of our questions are: 1. How does playing Mutant Protectors work? At what point, if at all, is the resolving player’s identity the defender? 2. What exactly does it mean to “declare [a character] the defender” for an attack? 3. After playing Mutant Protectors, did I “defend”? Can I trigger “Indomitable”? If my identity took no damage, can I trigger “Unflappable”?

There are two main considerations for the Mutant Protectors card: The “defense” keyword signals that the player controlling Mutant Protectors is now the defender of the attack. While your ally defends against an attack, “you” are not the one defending. In other words, following an enemy’s attack initiation, you can play Mutant Protectors as a Hero Interrupt to declare yourself as the defender of the attack, and then immediately play an X-Men ally to become the new defender of the attack (who ultimately takes the damage from the attack).

Only one character can be the defender of an attack (the X-Men ally in this case), so your identity would not be considered the defender of the attack, and you could not resolve Indomitable or Unflappable in response to the defense.

-Alex

> If I play Armor Up on Master Mold while he is activating against me as Rasputin turning into Colossus, would he get a sentinel minion and attack me with no boost card? (Based on a previous Armor Up ruling)

If you were in Alter-Ego form when Master Mold was about to activate, you could use Armor Up to change to hero form and change Master Mold’s activation from a scheme activation to an attack activation. (You would need to play Armor Up right before Master Mold determines how he activates against you. MM’s Forced Interrupt triggers once he’s already determined to be scheming against you.)

-Alex

> A ruling we received about Armor Up and Master Mold has been confusing me. That ruling suggests that an interrupt to “when the villain activates” is a different (earlier) timing than an interrupt to “when the villain schemes”. The first (like Armor Up) can be triggered, and resolved, entirely before the second (like Master Mold) triggers, even if the latter is Forced. 1. If the window to play Armor Up is before the villain is determined to be either attacking or scheming (that is, before an interrupt like Master Mold’s can trigger), how is it possible for Confused to happen at that time, before Armor Up is playable?
>
> Why do status cards “know” what kind of activation is about to happen before an interrupt like Master Mold’s does? 2. As an example of an existing interaction that is “changed” by this shift in my understanding: What happens when Ebony Maw tries to activate against my hero while Ebony Maw is Webbed Up?

1. I will do my best to explain where we landed on this interaction.
   1. If the villain were Confused when it went to activate against an Alter-Ego Colossus, it must discard Confused; doing so replaces its entire activation. Armor Up can only be played as an interrupt to an activation, so it cannot be played if there is no activation to interrupt.
   2. Status cards need to be able to recognize the type of activation about to occur, otherwise they wouldn’t work as they were designed to.
2. If Ebony Maw had Webbed Up attached and went to make an attack activation, Webbed Up and Ebony Maw both have Forced Interrupt triggers, so they would resolve in the order of the players’ choice.

-Alex

> We are confused by the interrupt on Robert Kelly from the upcoming Mutant Genesis campaign expansion. It reads “Forced Interrupt: when an enemy resolves an undefended attack against you, deal that damage to Robert Kelly.” 1. When does this interrupt trigger? The general timing of Interrupts and the first paragraph Attack (Enemy Activation) seem to suggest that this may trigger upon the initiation of an attack (when its resolution begins), but that seems unintended. 2. Does this interrupt share a timing window with Tough? Does Tough “beat” it? 3. Does this interrupt share a timing window with Energy Barrier’s interrupt, and not allow EB to trigger because this interrupt is Forced? 4. Can a (defense) ability with a triggering condition like Side Step’s (“when you would take any amount of damage”) be played to interrupt the damage of an otherwise undefended attack against the first player when this Forced Interrupt is in play? 5. In the case of an attack that would be lethal without Robert Kelly’s interrupt, does an interrupt like Drax’s Too Stubborn To Die (“when Drax would be defeated”) trigger before this? 6. Is this interrupt intended to be a replacement effect? Does the first player’s identity also take damage when this triggers? 7. When does Robert Kelly change control in the case of the first player being eliminated? Do the players lose if that happens?

Broadly speaking, the Forced Interrupt on Robert Kelly resolves before damage would be dealt. If the attack is undefended, Robert Kelly will take the damage.

1. This interrupts Step 4 of “Attack: Enemy Activation.”
2. If your Hero is Tough, nothing will happen to Tough. All damage goes to Robert Kelly.
3. Robert Kelly’s ability being a Forced Interrupt takes priority over Energy Barrier.
4. Side Step could not be played if you are not taking the damage.
5. Drax could not trigger Too Stubborn to Die if the damage isn’t going to him.
6. No.
7. If the first player is eliminated, they should immediately pass the first player token, and Robert Kelly with it.

-Alex

> For the Mutant Genesis card “Homo Superior”, does it still surge if it attaches to a minion that is already tough. I’m trying to figure out if “otherwise” is conditional to part or all of the preceding sentence, as it doesn’t read well to me if part of the effect (attaching to a minion) can be fulfilled, but it says “otherwise.” My interpretation is that it only surges if no minion is available to be attached, but I’m looking for clarification.

Homo Superior will only gain surge if the text preceding “otherwise” cannot be fulfilled at all. If Homo Superior attaches to a minion that already has tough, Homo Superior will not surge.

-Alex

> Was looking over some spoilers for the upcoming Mutant Genesis, and I’m confused about the response on Operation Zero Tolerance, in the various cases where the ally doesn’t go to the discard pile. Such as: Regroup putting the ally back into your hand, a Mind-Controlled minion going to the encounter discard pile, or Clea shuffling into a player’s deck. Do any or all of these result in the ally going under the scheme?

All of those cards will go under Operation Zero Tolerance—its Forced Response takes precedence.

-Alex

> I’m a bit confused by what you mean by the Forced Response taking “precedence”. Clea and Regroup are both interrupts: When [the ally] is defeated. Which should come in timing priority before Operation Zero Tolerance’s Forced Response: After an enemy attacks and defeats an ally. Are you meaning something other than the forced response having timing priority? Does the scheme find the ally wherever they end up, and put them under the scheme, and so ends up taking “precedence” by being the last ability resolved?

- The short of it is that Operation Zero Tolerance doesn’t care where the ally is when it triggers, whether that ally is in your discard pile, hand, or deck.
- The Forced Response’s trigger of “after an enemy attacks and defeats an ally” would happen **after** that ally has left play, which is a part of being defeated. OZT needs to be able to find that ally in the discard pile (or other out-of-play area) to function at all.

-Alex

> With “Robert Kelly”, does his forced interrupt trigger if an ally defends?

Robert Kelly’s ability specifies that the enemy must resolve an “undefended” attack against you. If an ally defends for you, then the attack is not “undefended.”

-Alex

> If the forced response on the main scheme “Asteroid M” causes you to empty the encounter deck from discarding and you didn’t reveal a MAGNETIC card, does that mean you don’t remove the 3 magnet counters? Does “then” on the last effect here mean everything before it must resolve or be true?

Because Asteroid M’s ability says “Reveal that card, then remove 3 magnet counters”, you only remove the magnet counters if a Magnetic card was revealed. If you emptied the deck during the discard without finding a Magnetic card, you wouldn’t remove any counters.

-Alex

> I put the new Operation Zero Tolerance modular encounter set in as the modular encounter set in Infiltrate the Museum (Collector#1). During game play, the Operation Zero Tolerance side scheme enters play. Next, an ally is defeated by an enemy. Does the defeated ally go into the collection or under the Operation Zero Tolerance side scheme? Entering the Collection is Forced Interrupt, and going under OZT is a Forced Response, and the trigger is similar but the wording is different. One is when a card is discarded from play, and the other is when defeated.

It’s placed under Operation Zero Tolerance. Operation Zero Tolerance triggers “after an enemy attacks and defeats an ally”—the ally being defeated is a condition that occurs before the ally is “discarded from play”, which is when Collector’s Forced Interrupt triggers.

-Alex

> If the defeated ally from the example above does go under Operation Zero Tolerance in the Infiltrate the Museum scenario, what happens to any allies beneath it? Do they all enter the collection along with the side scheme itself? Or is it more similar to Hawkeye’s Quiver and its arrows, with the side scheme entering the collection and the allies simply being discarded as they were not “in play” beneath the side scheme?

If OZT leaves play, only OZT would go to The Collection, and the allies underneath it would go to their respective discard piles because they weren’t “discarded from play.”

-Alex

> We have a ruling that Mutant Protectors circumvents the normal rules of one defender declared per attack, with the card briefly making the \*player\* the defender and then the ally that enters play. The 1.4 rules state that, when playing a Hero Interrupt (Defense) event – which is what Mutant Protectors is – that the player’s \*identity\* becomes the defender and is considered to have defended. In the original ruling, should it have said identity in line with the Defense entry instead of player?

Yes, the ruling should have said “identity” instead of “player.” I am sorry for using the wrong term.

-Alex

> If Mutant Protectors does first make your identity the defender, we’re wondering if you can play other cards that trigger when your hero defends during that brief window before your ally is declared the defender? Example: The villain attacks me. If I play Mutant Protectors, is there a window where I can play Never Back Down at any point during the resolution of the villain’s attack and my defense?

No, Mutant Protectors would not allow you to play a card like Never Back Down before the X-Men ally is declared the defender of the attack. The ally being declared the new defender happens immediately.

-Alex

> Let’s say the villain attacks me again. I put Nightcrawler into play with Mutant Protectors, then use Nightcrawler’s ability on himself against the villain’s attack. Has my identity (or anyone) defended the attack?

Yes; though you prevented the damage, Nightcrawler has still defended.

-Alex

> In a similar vein, if I play Mutant Protectors and the boost card’s boost effect defeats the ally that was put in play and considered to defend, has anyone defended the attack?

Yes. Per the rules of Defense-traited cards, the identity that plays them becomes “the defender” for that attack. Mutant Protectors is just a special case where being “the defender” is immediately passed onto the X-Men ally put into play. Should that ally leave play due to a boost effect, we are ruling that the player that played Mutant Protectors (a Defense-traited event) would revert to being “the defender” in that situation.

-Alex

> If I play Powerful Punch first in any of the above examples, do any of the answers change?

Yes, you could play Powerful Punch first and Mutant Protectors after.

-Alex

> I was looking at the Magneto scenario in Mutant Genesis, and I noticed that about 1/4 of the magnetic cards add a magnet counter when revealed. When these cards are revealed as part of the response on the main scheme, does adding the magnet counter re-trigger the response before the counters have been removed (resulting in another Magnetic card)? If it doesn’t trigger the Forced Response, why not?

No; you should remove the 3 magnet counters first before resolving the Magnetic card you revealed.

-Alex

> My confusion doesn’t lie in the interaction between Armor Up and statuses per se, but with this Master Mold ruling in particular: <https://hallofheroeslcg.com/latest-ffg-rulings/#34>
>
> I am happy to hear that the Forced Interrupts on Webbed Up and Ebony Maw interrupt the same window, because that lines up with my previous (pre-Armor-Up) understanding.
>
> 1. Does the “would” in Webbed Up’s triggering condition have any effect, making it trigger before Ebony Maw?
>
> 2. If these two abilities trigger at the same time, should Master Mold and Armor Up trigger at the same time as well? (with Master Mold triggering first by being “Forced”?)

1. Thank you for that observation; given that there are rules on “Would” I did not initially consider, we are adjusting our previous answer. The presence of “Would” in Webbed Up does mean it has priority over Ebony Maw’s Forced Interrupt; “would attack/activate” has priority over “attacks/activates.”
2. This conversation has brought us to an errata we’d like to give to Armor Up, that it should have said “When the villain **would activate**” instead of what it says now. Does adding this to Armor Up clear up the interaction between it and Master Mold?

-Alex

> We recently heard that Heroic Strike has to deal its damage to an enemy for the player to be able to stun “that enemy.”
>
> 1. This ruling (<https://hallofheroeslcg.com/latest-ffg-rulings/#127>) seems to say the opposite about a similar situation, are these in conflict?
>
> 2. Is the stun from Heroic Strike only prevented in cases where the damage “dealt” is replaced (like Bell Tower or Armored Rhino Suit), or is it also prevented in the case where damage “taken” is replaced (like Tough or Magnetic Bubble), and/or where the damage is reduced to 0 (like Wide Stance x6), and/or where the damage is prevented (like Temporal Shield), and/or when the target “cannot take damage” (like Sanctuary)?
>
> 3. Psychic Assault, Swinging Web Pig, Phased Strike, and Web-Trap are worded very similarly to Heroic Strike. Do they work in the same way? 4. What about Drop Kick? If I pay for it with all physical and all 4 of its damage doesn’t land, do I stun the enemy? can I draw a card? 5. Can I play Tackle or Concussive Blow against a stalwart or already-statused enemy, damaging it if I paid the appropriate resource type? (similarly, can Vision play Phase Disruption against a Stalwart enemy to discard an attachment?) 6. How does Sonic Rifle work? Can I deal 3 damage to “that enemy” if i did not confuse it?

1. For the linked ruling, Venom Blast dealt damage to 1 specific target, and that target become “that enemy” for being able to “stun that enemy.” The difference with Bell Tower is that the target of the Heroic Strike attack was directed at Bell Tower, which is not an enemy, and cannot be Stunned.
2. As long as the damage was *dealt* to a targeted enemy, that enemy can be Stunned with Heroic Strike. Maybe it would help to phrase it as, an enemy must be the target of the damage from Heroic Strike, whether or not that damage is taken/applied.
   1. Each of the mentioned cards do not prevent the enemy from being the target of the damage (and therefore “dealt the damage”) except [Armored Rhino Suit](https://marvelcdb.com/card/01098), which specifically replaces the dealing of damage.
3. Yes, they work similarly. If their damage was dealt to a targeted enemy, their secondary effects can also apply to that enemy.
4. Yes, Drop Kick works just like the others, you’d be able to stun the targeted enemy and draw 1 card regardless of if the damage was all “taken.”
   1. Also, if you paid for Drop Kick with only physical resources but dealt its damage to Bell Tower instead, you’d still be able to draw the card, because the card draw is not dependent on there being a targeted enemy.
5. Yes, you can play Tackle and target a Stalwart/“unstunnable” enemy.
   1. Yes, you can play Phase Disruption and target on a Stalwart Enemy.
6. Your two options with Sonic Rifle are either to Confuse an enemy, or deal 3 damage to an already Confused enemy. You could not deal 3 damage to an enemy that isn’t (or can’t be) Confused.

-Alex

> The “M-Type Sentinel” card from the Magneto set (Mutant Genesis) has a boost ability that states: “Give Magneto a Tough status card and a facedown boost card”. Generally abilities that give facedown boost cards to enemies are meant for those boost cards to be used for later activations. Meanwhile effects that are meant to give boost cards for current activations usually state to give additional boost cards to the enemy (with no “facedown” specification). But in “M-Type Sentinel’s case it is a boost ability that happens while resolving boost cards. If this boost ability was resolved during Magneto’s activation, should that “facedown” boost card be flipped during that same activation or should it be saved for a later activation? In a more general sense how are the steps for dealing with boost cards meant to be resolved? The rules state to flip boost cards one at a time, but they aren’t clear (to me) whether resolving boost abilities (which is only mentioned in the next bullet point) is something that you do after each individual flip or after all boost cards are flipped.

When you reveal M-Type Sentinel as a boost card, you’d give Magneto a tough status card and an additional boost card to be revealed during that same activation. In hindsight, the “facedown” specification was not needed for this card.

-Alex

> I have a couple of questions regarding the second scenario in the Mutant Genesis campaign (Project Wideawake) 1. What happens to the scenario allies (Project Wideawake #6-9), if they’re defeated by something other than an enemy attack? The rules on Ownership and Control (RRG v1.4, page 22) imply that they should go to the discard pile of their owner, but they’re scenario cards, so does that mean they go to the encounter deck discard pile? Even though they have player card backs? 2. Similarly, what happens to the Jubilee and Magneto allies if defeated by an enemy? Do keywords have priority over a Forced Response, causing them to go to the victory display? Or will they get tucked under the Operation Zero Tolerance side scheme?

Once you’ve earned the allies from the scenario, they’re considered a part of your deck. They will go to the discard pile of the player that “owns” them. Jubilee and Magneto would first get placed in the victory display following the “Victory” keyword, but then they would get placed under Operation Zero Tolerance immediately after. They will end up placed beneath Operation Zero Tolerance.

-Alex

> We’d like to learn more about “dealing” and “taking” damage. 1. Would you describe the process of dealing damage to us? 2. What happens if Nimrod is dealt 11 damage by an attack with Overkill? 3. What happens if Nimrod has a Tough status card and is deal 11 damage by an attack with Overkill? 4. What happens if a 9-HP minion with a Tough status card (and no other abilities) is dealt 11 damage by an attack with Overkill?

- Damage dealt refers to the damage that one character is attempting to place on another character. Damage taken is the damage actually placed on the targeted character.
- The Overkill damage would be calculated based on the target’s remaining health. Nimrod’s ability would not affect this calculation. If Nimrod had all 9 health, and was dealt 11 damage, only 2 of that damage is considered “excess” and would be placed onto the villain. Meanwhile, Nimrod’s ability means he would only *take* 3 of the damage that was dealt to him.
  - To summarize, 11 damage was *dealt*, Nimrod *took* 3, and the villain *took* 2.
- The Tough status card would prevent any Overkill damage from being dealt to the villain.

-Alex

> I have a few questions about the third scenario in the Mutant Genesis campaign (Master Mold). 1. On Rescue Captives (Mutant Genesis 173B) it says “Response: After you defeat a Sentinel minion, spend 1 resource of any type -> choose a facedown ally under this card and put it into play under your control. (Any player may trigger this ability)”. We played the trigger condition as ‘identity you’, even though the rest of the ability, and the parenthetical, implies ‘player you’, were we correct, or could, say, the first player use Magneto to defeat a Sentinel and then trigger the Rescue Captives response to rescue an ally? 2. When a player triggers the response on Rescue Captives, can they choose an ally they do not own, or must they choose the ally they put under Find the Prisoners (Mutant Genesis 173A) during scenario setup? 3. Can this response ‘cheat in’ an ally, allowing a player to put into play an ally that otherwise could not play?
>
> 4. Can it ignore the uniqueness rules? 5. If a player can rescue an ally they do not own, I assume that ally goes to their owner’s discard pile when they are defeated, is that correct? 6. During setup of the scenario, the players are given the Captive allies recorded in the campaign log, to shuffle into their decks. Does a player now own the ally shuffled into their deck in this way? 7. Do these allies remain a part of the players’ decks for the remainder of the campaign, or should they be removed at the end of the scenario?
>
> 8. In the Victory instructions for the scenario it says “Record the name of each ally that ended the game under Find the Prisoners or Rescue Captives. These allies cannot be used for the rest of the campaign”. What does “used” mean in this context? 9. Can the recorded allies be included in a player deck? 10. If they can be included in a player deck, can they be used as a resource? 11. If they cannot be included in a player deck, what happens if they are an ally from a hero’s signature card set?

1. To trigger the response on Rescue Captives, **your identity** must be the one to defeat a *Sentinel* minion.

2. The ally that you choose does not need to be the same one you placed underneath Find the Prisoners.

3. Yes, it would be possible to put an ally into play this way that you couldn’t normally.

4. No, the rules of uniqueness would still apply to these allies.

5. Yes, if the rescued ally is defeated/leaves play, it would go to its **owner’s** discard pile.

6. Yes, a player is considered to “own” earned campaign cards (Captive allies, in this case).

7. Earned campaign cards (i.e. Captive allies) are considered part of the player’s deck during that campaign and will remain in the player’s deck during future scenarios in that campaign unless otherwise stated. When the campaign ends, these cards should be removed.

8-10. “Cannot be used” in this case means that the named card cannot be included in player decks during the rest of the campaign.

11. If a hero’s signature ally was recorded as “cannot be used”, then they should not be included in that deck for the rest of the campaign. If this would cause a hero to have less than 40 cards in their deck, they should add another eligible card to their deck to get back up to 40 (e.g. an aspect card or basic card).

-Alex

> Can an eliminated player reveal a card? Playing against Magneto as Cyclops and Phoenix. Scott Summers revealed Metal Shards. He had 1 HP so this eliminates him. RRG says to continue resolving the encounter card. It places the 3rd magnet counter on the main scheme. The main scheme now triggers. What happens? The main scheme says “you” reveal a card. So, 1) Does the ability not trigger because “you” is eliminated? 2) The ability triggers and “you” reveal the magnetic card as an eliminated player. 3) The ability triggers and you do the discarding from encounter deck until you hit a magnetic card, but then it fizzles as an eliminated player cannot reveal a card. 4) The ability transfers to the next player in player order and they become the “you” and they reveal the encounter card. If it matters, the revealed card is Magnetic Bubble.

Alex: In this case, we rule that the eliminated player should finish resolving Metal Shards by placing the magnet counter on the main scheme, but they should not resolve the Forced Response on the main scheme.

-Alex

> What happens in the sabretooth scenario, if the player has Robert Kelly and you exhaust and defend with night crawler but use his ability what happens?

If Nightcrawler exhausted to defend an attack, then he is considered to have defended the attack, even if he leaves play due to his ability. Robert Kelly wouldn’t take any damage.

-Alex

> Where does the Magneto ally from Mutant Genesis (which is double-sided) go when he is defeated while Beguiled is attached to him?

The Magneto ally should be placed in the victory display when defeated, even if he had Beguiled attached to him.

-Alex

> Does the sabertooth villains forced response trigger even when he’s already at full health?

Yes, Sabretooth’s Forced response will always trigger after he activates, and the top card of the encounter deck will always be discarded. If he’s at full health, though, he simply won’t heal.

-Alex

---
