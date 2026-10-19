# October, 2023

> **Source:** [Hall of Heroes: Latest FFG Rulings (post RRG 1.5)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/#october2023)  
> **Fetched:** 2026-10-18. Transcribed by script from Hall of Heroes; Hall of Heroes is the transcriber, not the authority.  
> **OLDER FFG rulings, tier 4 in CLAUDE.md's rules authority order:** valid only where consistent with RRG v1.8, superseded where v1.8 contradicts them; FFG calls contact-form answers preliminary until a Rules Reference update includes them.  
> **Newer rulings:** [marvel-champions-rulings-post-rrg-1-7.md](../../../marvel-champions-rulings-post-rrg-1-7.md). **Regenerate:** `uv run scripts/scrape_rulings_markdown.py` (do not edit by hand).

---

## October, 2023

>  95 – If I were to use Psylocke’s flurry of blades on three different enemies who all have retaliate 1, (dealing 2 damage to one, confusing one and dealing 2 damage to the final enemy) would each enemy trigger retaliate against Psylocke, so she takes 3 damage back? If I were instead to target one enemy who again has realitate 1 (dealing 1 damage and then confusing it and then dealing 2 damage to it) would the retaliate trigger 1 for the whole attack? How does Psychic illusion in Psylocke’s nemesis interact with flurry of blades. It’s interrupt triggers when an enemy is attacked. When I play flurry of blades the interrupt would trigger, then after I deal 2 damage to an enemy would it trigger again each time I choose to confuse an enemy or deal 2 damage to it or would it only trigger if I choose to target a different character with the confuse or deal 2 options?

1. If you play Flurry of Blades and target a different enemy for each instance of damage, then each of those enemies will trigger their Retaliate and deal damage back to you. You are considered to have “attacked” each enemy you deal damage to with an attack event.
2. If you play Flurry of Blades and target only one enemy for each instance of damage, the enemy triggers its Retaliate only once. This is because you are considered to have made “a single attack” for any attack event that doesn’t explicitly state you made multiple attacks (e.g. Dance of Death).
3. With Psionic Illusion, you’d essentially resolve its Forced Interrupt each time you choose a target that has not already been chosen for Flurry of Blades, and you’d discard Psionic Illusion whenever you end up targeting a friendly character.
   1. For example, say you’re resolving Flurry of Blades and you’re dealing the first 2 damage to a target. You attempt to target the villain, but Psionic Illusion’s Forced Interrupt must resolve before the damage. The card you discard has a resource of the named type, so you deal 2 damage to the villain and keep Psionic Illusion in play. You can continue to target the villain for the rest of Flurry of Blades without triggering the Forced Interrupt on Psionic Illusion. If you change which enemy you’re targeting, though, you are “attacking” a new enemy and must resolve the Forced Interrupt on Psionic Illusion again.

-Alex – **October 5, 2023**

> 96 – I have a question about defending an attack. I’m playing as the Spectrum hero and an enemy attacks me. I exhaust my hero to use my basic DEF power of 1, and play Pulsar Shield, changing form, readying and getting +2 DEF, can I then exhaust to use my DEF again making my total DEF 6?

No, you can only use a basic defense once per attack. You can’t exhaust and apply your DEF multiple times for the same attack.

-Alex – **October 5, 2023**

> 97 – Its been ruled that if a minion with Quickstrike engages Black Widow then Quickstrike initiates an attack but the response on Widows bite can resolve before the attack. If I were to trigger widows bite after on a minion with Quickstrike when would I resolve the responses Blackwidow or Syth Suit which both response to triggers a preparation card. Do these responses trigger before the attack resolves, immediately after I trigger widows bite or do I need to wait until after the attack.

Before the attack resolves, in response to the new triggering condition. The sequence of events is this:

- The Quickstrike minion engages Black Widow.
- Quickstrike resolves, telling the minion to initiate an attack. The attack will resolve as soon as possible.
- The opportunity to resolve the Response on Widow’s Bite occurs, which must be between the attack initiation and resolution. Resolving this Response creates a new triggering condition, in which Black Widow triggered the ability of a *Preparation* card.
- Both Black Widow’s hero ability and Synth-Suit have Responses that can be triggered as a result of the aforementioned triggering condition; her controller decides the order in which to resolve them.
- After all of these steps, if the minion is still in play, its attack that was initiated resolves now. It does not lose Stunned since it initiated its attack before receiving the status from Widow’s Bite.

-Alex – **October 12, 2023**

> 98 – I have two questions regarding Morlock Siege: 1) If I use basic thwart with Domino’s Probabiliy, will I be able to boost ATK for the thwart on scheme with “Assault” keyword? 2) If the villain is stunned, does it mean the cost of “Pushed to the Limit” was paid? I guess not, since the Villain did not technically attack, though I’m not sure.

1. Yes, you can use Domino’s Probability Field to boost your ATK when thwarting a side scheme with Assault.
2. No. If the villain with Pushed to the Limit is Stunned, the cost of the Hero Action cannot be paid, so the ability cannot be initiated (“Initiating Abilities” Step 4). The villain will need to lose Stunned another way first.

-Alex – **October 12, 2023**

> 99 – I’m playing Stryfe and “His ability reads “while Stryfe is attacking you”, does this apply while an ally is defending? Or does it turn off whenever he’s attacking an ally?”

Yes, the ability is still active even when an ally is defending. For abilities that trigger “While \_ is attacking you,” “you” refers to the player attacked, and not necessarily the character that defended the attack.

-Alex – **October 12, 2023**

I was trying to make a deck that uses both LastStand and Med Lab and I’m confused.

> 100 – We received a ruling prior to the 1.5 rules reference regarding LastStand, that effectively says if you use LastStand on an ordinary ally while it’s attacking with 1 hp left, it is defeated by consequential damage before LastStand can discard it. The ruling says that consequential damage triggers first because consequential damage is considered part of the attack – but according to the new rules reference, under the section for consequential damage, it states that consequential damage comes after the attack.
>
> Which suggests to me that LastStand should actually come first. It is also part of the rules that responses to basic attacks from allies come after the attack is finished but before consequential damage.
>
> This is how I read it: Step 1: An ally uses its ATK to initiate a basic attack. Step 2: The attack is resolved. Step 3: You may use responses to the attack. Step 4: The ally takes consequential damage. Could you please clarify at what step LastStand discards the ally and how it interacts with Med Lab? Also, how does this interact with Rapid Response?

In essence, Last Stand will discard an ally **before** consequential damage would be dealt to that ally. The delayed effect on Last Stand makes sense to us as resolving at a similar timing point as a Response to the attack, like the ability on [Tigra](https://marvelcdb.com/card/01051), which occurs before consequential damage. We wouldn’t claim this is the case for every delayed effect, but this seems like the right call for Last Stand.

This new ruling would mean that playing Last Stand on an ally wouldn’t cause it to be defeated by consequential damage, so the ally could not be targeted by the response on Med Lab.

And, since the ally would be discarded but not defeated, Rapid Response couldn’t target it either.

-Alex – **October 12, 2023**

> 101 – If I use Mutant Protectors to put an X-Men ally into play can I trigger Utopia in response and ready that same ally after it becomes exhausted? I’m unsure because putting the ally into play and exhausting it are done by two separate sentences, making me wonder if the timing window for the response closes before the ally actually exhausts.

No. The window of opportunity to trigger Utopia is between the first and second sentences of the “Hero Interrupt” part of Mutant Protectors. The ally enters play, the window to exhaust Utopia occurs but the ally isn’t a valid target, then the ally exhausts.

-Alex – **October 26, 2023**

> 102 – I have some questions about the card Old Rivals in Nebula’s nemesis set. When it causes the Gamora hero or ally to attack: (1) Are players allowed to defend against this attack? The RRG only talks about defending against enemy attacks. (2) Can the Gamora hero or ally exhaust to defend against her own attack? (3) Can the Gamora player use a (defense) labelled ability to defend against this attack?

Yes, players can defend against the attack from Old Rivals. Yes. We discussed this and acknowledged that the rules do not restrict an attacking character and a defending character from being the same character. However, we did agree that if Old Rivals causes the hero or ally Gamora to attack a player, that Gamora is not considered “an enemy” during the attack since she is not a minion or villain, so she’s not a valid target for abilities that target enemies. Yes, so long as the previous rule is followed.

-Alex – **October 26, 2023**

> 103 – I’m playing as the new Angel hero and wanted to make sure about something. An enemy initiates an attack against me and I play Aerial Agility which is a (defense), can I still exhaust to use my basic DEF power? Same question if an enemy initiates an attack against another player. Secondly if I use his resource card Avian Anatomy to pay for Aerial Agility, does AG return to my hand before the boost card is flipped during that attack?

1. Yes, you can do both. Playing a defense event doesn’t prevent you from making a basic defense for the same attack. And yes, you can do both when another player is being attacked. Just note that only one character can be the defender of an attack.
2. Yes. Aerial Agility creates a lasting effect when it’s played, and if you used Avian Anatomy to pay for it, you will return Aerial Agility to your hand as soon as the lasting effect is created.

-Alex – **October 26, 2023**

> 104 – We have some questions about the new minion, Malice.
>
> 1.Can you blank the text box on Malice while it’s attached to an ally turned minion? And if so does this cause the minion to turn back into an ally? 2.Is Malice still considered a minion while attached to an ally? 3.Can you attack the Malice minion while it’s attached to an ally? 4.Can you discard/defeat her while she’s attached with cards which do explicitly that such as the Nova Prime ally or the Take out the guards player side scheme?

These are some good questions for the Malice minion, some of which we hadn’t considered before. Here are our current rulings on her.

1. Yes, you can blank Malice while she’s attached to any ally-minion; if you do, Malice’s ability stating the ally is a minion is inactive, meaning the ally-minion will revert to being an ally for the duration of the blanking ability, and can be used as an ally during that time.
2. Yes, Malice still has the minion card type while attached.
3. Yes, Malice can be attacked while attached to an ally.
   1. Note, Malice cannot be defeated more than once per instance of her—in other words, you can only trigger her “When Defeated” once between the time she enters play and leaves play. (She doesn’t leave play when she attaches.) So although she can be attacked and targeted, she will not unattach or leave play unless the ally she’s attached to leaves play, or she’s discarded (see below).
   2. Also note, Malice is still a “minion” and “enemy,” but she’s not considered engaged with you while she’s attached, and will not activate.
4. Yes, you can discard Malice while she’s attached (e.g. via Take Out the Guards), but you can’t “defeat” Malice while she’s attached.

-Alex – **October 26, 2023**

> 105 – If I attack the Malice minion with an ally with 1 HP left, does the ally turned minion become defeated by consequential damage or does malice effect stop that consequential damage? We’re not sure if CD is more like a response or a delayed effect that turns on the moment you use one of your allies basic powers Unrelated question. For an effect that states “attacks and damages”, is that referring to dealt damage or damage that character “takes”?

1. Assuming Malice attaches to the same ally used to attack her, then no, that ally-minion would not take consequential damage (CD). This is because Malice’s “When Defeated” ability would resolve before CD is dealt to that ally, and the ability prevents the ally from taking CD.
2. If an ability checks if a target was “attacked and damaged,” the target of the attack needs to have taken damage from the attack.

-Alex – **October 26, 2023**

> 106 – So I play the scarlet witch Hex bolt event while her nemesis side scheme, the next evolution is in play which increases the number of boost icons for each encounter card. Does hex bolt check the current amount of boost icons on each discarded card all at once and remember them? Or does it check each time you resolve one of the bulleted effects? Example, you choose to use the first bullet effect to remove two threat and defeat the next evolution side scheme, does the other two effects now change from what they were going to be?

No. The Next Evolution side scheme has a constant ability, so it only affects boost icons while it’s in play. As soon as it leaves play, the boost icons on cards revert to their printed values. Say you play Hex Bolt and are able to remove the last 2 threat from The Next Evolution with one of the discarded cards. As soon as TNE leaves play, the other discarded cards are resolved as normal. Note that you can choose which order to resolve the cards discarded by Hex Bolt, so if having TNE in play helps you, you can choose to remove the threat on it last.

-Alex – **October 26, 2023**

> 107 – With the new out of reach attachment from the flight encounter set, can the villain take non attack damage? It’s worded in such a way that it seems to be only referring to attack damage so we’re not sure.

No; while the villain has Out of Reach attached, the villain can’t take non-attack damage\*. The villain will only take damage ~~from Aerial characters~~\*, Aerial attacks, or ranged attacks.

\*Sorry, I should have said “The villain will only take damage from attacks made by an Aerial character…” rather than “Aerial characters” straight up. Everything else is still accurate.

-Alex – **October 26, 2023**
