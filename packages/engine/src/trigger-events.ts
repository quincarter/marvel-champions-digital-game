import type { AbilityId, CardId } from "@mc/content";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import type { CardDestination } from "./spec.js";
import type { Vars } from "./stack.js";

/**
 * Something that happens in the game and that abilities can hook. Every one of
 * these gets an `interrupt` window before it and a `response` window after it
 * when it resolves through the stack (RRG "Ability: Simultaneous Timing
 * Priority").
 */
export type TriggerEventBody =
  | {
      readonly kind: "dealDamage";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      /** Damage from an attack; defense, retaliate and overkill key off this. */
      readonly fromAttack: boolean;
      /** The attack/activation event frame this damage belongs to; damage/defeat results are reported there. */
      readonly parentFrameId?: FrameId | null;
      /** This attack has overkill even if its source lacks the keyword (Relentless Assault, Charge). */
      readonly overkill?: boolean;
      /** "This damage ignores tough status cards" (Lightning Strike, errata RRG 1.8 p. 65): taken through a tough status card, which stays. */
      readonly ignoreTough?: boolean;
      /**
       * This attack has piercing even if its attacker lacks the keyword ("this attack gains piercing"): the attacked
       * character's tough status cards are discarded before damage (RRG 1.8 "Piercing", p. 32). Stamped when the
       * attack pushes its damage, so every way of granting the keyword is already folded in.
       */
      readonly piercing?: boolean;
      /** The card whose ability produced this damage when that isn't the source ("damage from Black Panther upgrades"). */
      readonly viaInstanceId?: InstanceId | null;
      /** An ally's consequential damage (RRG 1.8 "Consequential Damage", p. 13), so "for this use" can cancel it (§3.21). */
      readonly consequential?: true;
    }
  | { readonly kind: "healDamage"; readonly targetInstanceId: InstanceId; readonly amount: number }
  | {
      readonly kind: "placeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      readonly parentFrameId?: FrameId | null;
    }
  | {
      readonly kind: "removeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      readonly parentFrameId?: FrameId | null;
      /** "…, ignoring any crisis icons in play": this removal skips the crisis check (RRG 1.8 "Crisis Icon", p. 14). */
      readonly ignoreCrisis?: boolean;
    }
  | {
      readonly kind: "attack";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly playerId: PlayerId;
      /** Damage for an "(attack)" ability; absent/null = the attacker's ATK (a basic attack). */
      readonly amount?: number | null;
      readonly basic?: boolean;
      readonly overkill?: boolean;
      /** "This attack gains piercing/ranged": keywords this attack has that its attacker need not (`AttackKeyword`). */
      readonly keywords?: readonly ("piercing" | "ranged" | "overkill")[];
      /** The card whose ability made this attack (the event card for "Hero Action (attack)"). */
      readonly sourceInstanceId?: InstanceId | null;
      /**
       * The same attack resolved against another target ("resolve this attack against each minion engaged with that
       * player", Thor 25013; `EffectSpec resolveAttackAgainst`, docs/phase7-wave4.md §3.22): the attacker's own "when
       * it attacks" abilities don't re-trigger, as with an enemy attack's `additionalResolution`.
       */
      readonly additionalResolution?: true;
    }
  | {
      readonly kind: "thwart";
      readonly thwarterInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly playerId: PlayerId;
      /** Threat removed by a "(thwart)" ability; absent/null = the thwarter's THW (a basic thwart). */
      readonly amount?: number | null;
      readonly basic?: boolean;
      /** A basic thwart made with ATK instead of THW (the Assault keyword, or "may use their ATK"; §3.11). */
      readonly useAtk?: boolean;
      /** "…, ignoring any crisis icons in play": passed to the threat removal this thwart makes. */
      readonly ignoreCrisis?: boolean;
      /** "…, ignoring the patrol keyword": this thwart is not stopped by patrol (docs/phase7-wave4.md §3.32). */
      readonly ignorePatrol?: boolean;
      readonly sourceInstanceId?: InstanceId | null;
    }
  /** A defender was declared (basic defense) or a "(defense)" ability made the identity the defender. */
  | {
      readonly kind: "defended";
      readonly defenderInstanceId: InstanceId;
      readonly enemyInstanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly basic: boolean;
    }
  | {
      readonly kind: "enemyAttack";
      readonly enemyInstanceId: InstanceId;
      /** The player the attack was initiated against (RRG p.9: "attacks you" keys off this). */
      readonly attackedPlayerId: PlayerId;
      /** The player who ends up targeted — changes if another player defends. */
      readonly targetPlayerId: PlayerId;
      readonly targetInstanceId: InstanceId;
      /** The same attack resolved against another player (Whirlwind): the attacker's "when it attacks" abilities don't re-trigger. */
      readonly additionalResolution?: boolean;
      /** "That attack does not get a boost card" (Escaped Convict, I See You): step 1 deals nothing. */
      readonly noBoost?: boolean;
    }
  | {
      readonly kind: "enemyScheme";
      readonly enemyInstanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly noBoost?: boolean;
    }
  /**
   * A boost card was turned faceup during an activation (RRG 1.8 "Boost", p. 11), before its "Boost" ability resolves
   * and its icons are added: "When a boost card is turned faceup" (Attacrobatics, an interrupt) and "After a boost card is
   * turned faceup" (Target Acquired, a response). `boostIcons` is what it would add now, 0 once cancelled.
   */
  | {
      readonly kind: "boostCardTurnedFaceup";
      readonly enemyInstanceId: InstanceId;
      readonly boostInstanceId: InstanceId;
      readonly activation: "attack" | "scheme";
      readonly boostIcons: number;
      /** The player the activation is against ("you"). */
      readonly playerId: PlayerId;
    }
  /**
   * An enemy attacks another enemy ("That minion attacks another enemy of your choice", Moondragon; `EffectSpec
   * enemyAttacksEnemy`, docs/phase7-wave3.md §3.23). An attack but not an activation (§4 Q12, the user's decision,
   * 2026-09-23), so it is deliberately not an `enemyAttack`: no boost card, no defense, and no "when this enemy
   * attacks/activates" ability hears it. Its interrupt window comes before the damage; its apply step deals the
   * attacker's ATK to the target as attack damage and names the target in a `characterAttacked` event (retaliate).
   * No player is a subject: nobody is attacked, and the player whose ability caused it is not attacking.
   */
  | {
      readonly kind: "enemyAttacksEnemy";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      /** The card whose ability made the attack (Moondragon), for the log. */
      readonly sourceInstanceId: InstanceId | null;
    }
  /**
   * "After [character] is attacked", named after the attack's damage resolves so
   * the target is the character that was actually hit (the defender, if one was
   * declared). Retaliate X hangs off this; so does any card ability worded the
   * same way.
   */
  | {
      readonly kind: "characterAttacked";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly playerId: PlayerId | null;
      /**
       * The attack had ranged (printed on the attacker, or granted to this attack alone), so it "ignores the retaliate
       * keyword" (RRG 1.8 "Ranged", p. 35). Stamped when the attack pushes this event, alongside `dealDamage.piercing`.
       */
      readonly ranged?: boolean;
    }
  | { readonly kind: "cardEntersPlay"; readonly instanceId: InstanceId; readonly playerId: PlayerId | null }
  | { readonly kind: "cardPlayed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * A card has been paid for and is about to resolve: "When you play an [Attack] event" (Embiggen!, Shrink). An
   * interrupt here happens before the card's own abilities resolve, which is what lets a modifier apply to every
   * instance of damage the event deals. `cardPlayed` stays where it is — announced after the card has resolved — so
   * "after you play" responses are unaffected. Only put on the stack when an ability could react (`heard`).
   */
  | { readonly kind: "cardBeingPlayed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly kind: "cardRevealed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * Cards were spent from a player's hand to generate resources for one payment (docs/phase7-wave2.md §12): "Hero
   * Response: After you spend this card, …" (Pym Particles 12006 and seven more), "Interrupt: When you spend this card
   * to play an ally, …". One event per payment, listing every card that payment spent, so the responses of several
   * spent cards share one window and their controller orders them (RRG 1.8 "Response", p. 38: responses to triggering
   * conditions one effect causes "can be resolved in any order").
   *
   * **When.** Pushed once the costs are paid (step 5 of RRG 1.8 "Initiating Abilities", p. 24) and on top of the card
   * or ability being paid for, so both windows resolve before that card commences being played (step 6). RRG 1.8
   * "Cost Arrow Icon" (p. 14): "Responses to the text preceding the cost arrow icon resolve before the text following
   * the icon resolves"; ruling, Feb 28, 2026 (1): "Any abilities triggered by paying a cost resolve immediately before
   * the effect following the arrow resolves." Pushed only when an ability could react (`heard`).
   *
   * **Where the ability is.** The spent cards are in the discard pile by now, which the trigger scan does not read. RRG
   * 1.8 "Resource Card" (p. 37): "Some resource cards have card text that is active while using the card to generate
   * resources", and a spent resource "is also considered to be spent by that player's identity" — so while this event
   * resolves, each spent card's own abilities on this event are live, controlled by the spender (`resolve/triggers.ts`).
   *
   * - `cardInstanceIds`: the cards discarded from hand, in payment order. A "Resource:" ability of a card in play is not
   *   a card being spent, so it is not listed.
   * - `playerId`: whose hand they came from ("you"). `forPlayerId`: the player whose cost they paid — "After you spend
   *   this card **for a player**, heal 1 damage from that player's identity" (Everyday Hero 28019). They differ when
   *   another player helps pay for an alliance card (RRG 1.8 "Alliance", p. 6; docs/phase7-wave4.md §3.17): one event
   *   per spender, each naming the paying player as `forPlayerId`.
   * - `payingForInstanceId` / `purpose`: what the payment was for — the card being played (`playCard`), the card whose
   *   ability's cost it paid (`ability`), or neither (`effect`: "spend X resources" inside an effect). The played card
   *   is the event's *target*, so "When you spend this card to play a THWART event" is a `targetIs` query; an
   *   ability's source is deliberately not a target, so a query for "an ally" cannot match an ally's own ability cost.
   */
  | {
      readonly kind: "resourcesSpent";
      readonly cardInstanceIds: readonly InstanceId[];
      readonly playerId: PlayerId;
      readonly forPlayerId: PlayerId;
      readonly payingForInstanceId: InstanceId | null;
      readonly purpose: "playCard" | "ability" | "effect";
    }
  /**
   * An ally or minion at 0 hit points is being defeated. Interruptible ("when
   * attached minion would be defeated … instead", "when attached minion is
   * defeated"); the card leaves play when it applies. `overkill` carries excess
   * damage from an overkill attack, dealt only if the defeat happens.
   */
  | {
      readonly kind: "characterDefeated";
      readonly instanceId: InstanceId;
      /**
       * Defeated by an effect that says "defeat" (`EffectSpec defeat`; Nova Prime), not by reaching zero remaining hit
       * points, so applying it does not re-check the dial (docs/phase7-wave3.md §3.9).
       */
      readonly byEffect?: true;
      /**
       * Set by the defeat sweep on villains that reached zero together: whether each could be defeated ("cannot be
       * defeated while X has any hit points remaining") was read once for all of them, before any applied, so applying
       * one does not re-read it after another has already advanced to a fresh stage (docs/phase7-wave4.md §3.3).
       */
      readonly protectionChecked?: true;
      /**
       * The defeating damage was attack damage (`dealDamage.fromAttack`: an attack's damage, or its overkill spill), so
       * "When an ally is defeated by an enemy attack" (Regroup, `drax` 19032) is `fromAttack: true` with `sourceIs` an
       * enemy (docs/phase7-wave3.md §3.45). Absent for any other defeat.
       */
      readonly fromAttack?: true;
      /**
       * "Return it to its owner's hand instead of discarding it" (Regroup): where the defeated card goes instead of its
       * discard pile, set by an interrupt's `EffectSpec setDefeatDestination` (docs/phase7-wave3.md §3.45). It is still
       * defeated — When Defeated, Victory X and "after … is defeated" all still apply; only the discard is replaced.
       */
      readonly destination?: CardDestination;
      readonly parentFrameId?: FrameId | null;
      readonly overkill?: {
        readonly amount: number;
        readonly toInstanceId: InstanceId;
        readonly sourceInstanceId: InstanceId | null;
      };
      /**
       * The player whose card dealt the defeating damage ("after *you* defeat a
       * minion"), when the defeat came from a damage event with a player-controlled
       * source. It is the event's player subject, so `playerIs: "controller"` matches it.
       */
      readonly defeatedByPlayerId?: PlayerId | null;
      /**
       * **What** dealt the defeating damage, where `defeatedByPlayerId` is **who**: the card that was the damage's
       * source (the attacking character, or the card whose effect dealt it). It is the event's source subject, so
       * `sourceIs` matches it — which is how "After Wasp (or an event you play) defeats a minion" (Small but Mighty,
       * 13001a) says what "you defeat" cannot: an ally's attack has the same defeating *player* and a different
       * defeating *card*. Null when nothing player- or card-driven defeated it.
       */
      readonly sourceInstanceId?: InstanceId | null;
      /**
       * The cards attached to the character when its defeat was initiated ("is defeated", before any interrupt), set as
       * the event goes on the stack (`eventFrame`). By its response window the character has left play and a card
       * like Death-Glow has set itself aside, so "After the enemy with Death-Glow is defeated" (Flight of the
       * Valkyrior, 25008) reads this, through `EventPattern.targetHadAttachment` (docs/phase7-wave4.md §3.22).
       * Absent when nothing was attached.
       */
      readonly attachedInstanceIds?: readonly InstanceId[];
    }
  /** An encounter card has been flipped faceup and is about to resolve (RRG "Reveal"): the point to cancel it. */
  | { readonly kind: "encounterCardRevealing"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * A side scheme reached no threat and is defeated (RRG 1.8 "Defeat", p. 15). `defeatedByPlayerId` is the player
   * whose thwart or card effect removed the last threat — "the player who defeated this scheme" (Crossbones' Assault
   * 04070), "the defeating player" (Mystique's Manipulations errata, RRG 1.8 p. 66). Null when no player did it.
   *
   * `sourceInstanceId` is the card that removed that last threat, the `characterDefeated` field of the same name: the
   * thwarting character for a thwart (basic or "(thwart)"-labeled — the character performs it, RRG 1.8 "Thwart",
   * p. 44), the card whose effect removed the threat otherwise.
   */
  | {
      readonly kind: "schemeDefeated";
      readonly instanceId: InstanceId;
      readonly defeatedByPlayerId?: PlayerId | null;
      readonly sourceInstanceId?: InstanceId | null;
    }
  | { readonly kind: "villainStageAdvanced"; readonly stageIndex: number; readonly instanceId: InstanceId }
  /** `schemeInstanceId` is set only for a separate game area's own stage (docs/phase7-wave2.md §3.1). */
  | { readonly kind: "mainSchemeAdvanced"; readonly stageIndex: number; readonly schemeInstanceId?: InstanceId }
  /**
   * A main scheme stage was completed and did not end the game or advance: a separate game area's stage ("Forced
   * Response: After this stage is complete, …", Kang's stage 3 cards), or a stage whose next stage is a group of
   * alternatives that card text must choose among (docs/phase7-wave2.md §3.1, §3.4).
   */
  | { readonly kind: "mainSchemeCompleted"; readonly schemeInstanceId: InstanceId; readonly stageIndex: number }
  /**
   * A deck ran out of cards (docs/phase7-wave4.md §3.11): "After your deck runs out of cards" (Soul World, `mts` 21033) and
   * "After a player resets their deck" (Universal Church of Truth, 21068) are a player's deck, which resets the moment it
   * empties (RRG 1.8 "Player Deck", p. 33); "After the infinity stone deck runs out" (Thanos I–III, 21111–21113) is a
   * scenario deck. Announced between frames, and only when an ability listens.
   */
  | {
      readonly kind: "deckRanOut";
      readonly deck: "player" | "scenario";
      readonly playerId?: PlayerId;
      readonly name?: string;
    }
  /**
   * Counters are removed from a card by an effect (docs/phase7-wave4.md §3.15): "When the last lock counter is removed from
   * here" (Holding Cell, `aos` 50105a, an interrupt), "After the last invocation counter is removed from Fireball"
   * (`mts` 21076–21079), "After the last power counter is removed from here" (Phoenix Force, `phoenix` 34002a).
   * `remaining` is what the card will hold after the removal (`eventAtMost: { remaining: 0 }` is "the last"). Pushed
   * only when an ability listens; its apply step removes them (so the uses keyword's discard follows).
   */
  | {
      readonly kind: "countersRemoved";
      readonly instanceId: InstanceId;
      readonly counterType: string;
      readonly amount: number;
      readonly remaining: number;
    }
  /**
   * "After Loki is swapped with a set-aside Loki villain" (Loki's Cape, `mts` 21172): `EffectSpec swapVillain` exchanged
   * the villain's card (docs/phase7-wave4.md §3.7). Response window only; pushed only when an ability listens.
   */
  | {
      readonly kind: "villainSwapped";
      readonly villainInstanceId: InstanceId;
      readonly fromCardId: CardId;
      readonly toCardId: CardId;
    }
  /**
   * A main scheme stage **would be** completed by reaching its target threat (docs/phase7-wave4.md §3.4): "Forced
   * Interrupt: When this stage would be completed, remove all the threat from this stage instead." (Under Siege and The
   * Armies of Thanos, `mts` 21098b/21099b; Upgrading Adaptoids 1B, `aos` 50104b). Pushed only when an ability listens;
   * its apply step completes the stage (a loss on the final stage, else When Completed and the advance) unless an
   * interrupt cancelled it or the threat has fallen below the target.
   */
  | { readonly kind: "mainSchemeCompleting"; readonly schemeInstanceId: InstanceId; readonly stageIndex: number }
  /**
   * A boost card's icons are about to be counted for an activation (docs/phase7-wave2.md §3.6): "When boost icons on an
   * encounter card would be counted" (Chaos Control) and "increase or decrease the number of boost icons on that card by
   * 1 for this count" (Scarlet Witch's Crest) interrupt it with `replaceBoostCount` / `adjustBoostCount`. Announced only
   * when an ability could react. Counts made by card effects (Hex Bolt) are not announced yet (§4.8).
   */
  | {
      readonly kind: "boostIconsCounting";
      readonly enemyInstanceId: InstanceId;
      readonly cardInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  /**
   * A character used a basic power (docs/phase7-wave2.md §3.11): "After you use a basic power" (Quicksilver's Super
   * Speed; Captain Marvel ally 04032). FAQ "Quicksilver (#1A)" (RRG 1.8 p. 61): a stunned attack or a
   * confused thwart "is not considered to have used a basic power", so it is announced only once the power resolves.
   * Announced only when an ability could react. The *interrupt* side of the same moment is `basicPowerUsing`.
   */
  | {
      readonly kind: "basicPowerUsed";
      readonly characterInstanceId: InstanceId;
      readonly power: "attack" | "thwart" | "defense" | "recover";
      readonly playerId: PlayerId;
    }
  /**
   * A character is using a basic power, before the power's own value is read (docs/phase7-wave2.md §17.4): "Hero
   * Interrupt: When you use one of your hero's basic powers (THW, ATK, or DEF), … get +2 to that power for this use"
   * (Rapid Growth 13005), "When you use one of Venom's basic powers, … Venom gets +1 to that power for this use"
   * (Venom's Pistol). The interrupt twin of `basicPowerUsed`, the way `cardReadying` is to a ready and
   * `encounterCardRevealing` is to a reveal: one event whose shape is the same for every power, so a card that names
   * several of them at once is one trigger rather than one per power (each power's own event — `attack`, `thwart`,
   * the enemy attack a defense belongs to — has a different shape and a different subject).
   *
   * Pushed **on top of** the power's own events, so it resolves first: an interrupt to it runs before the power's
   * value is read, which is what "for this use" needs. Its *response* window therefore also runs before the power
   * resolves — "after you use a basic power" is `basicPowerUsed`, which is announced beneath the power.
   *
   * Not pushed for a basic recovery: that power has no event frame of its own (`basicRecover` heals in the command),
   * so there is nothing for an interrupt to precede. No card in the pool needs one — recovery is an alter-ego power
   * (RRG 1.8 "Recover, Recovery", p. 36; "Basic Power", p. 11) and every card that interrupts a basic power is either
   * a Hero Interrupt or names "(THW, ATK, or DEF)". The `power` field still covers all four so nothing changes shape
   * the day one does; see docs/phase7-wave2.md §17.4 for the change that would need.
   */
  | {
      readonly kind: "basicPowerUsing";
      readonly characterInstanceId: InstanceId;
      readonly power: "attack" | "thwart" | "defense" | "recover";
      readonly playerId: PlayerId;
    }
  /**
   * A card is about to ready (docs/phase7-wave2.md §3.11): "When attached character would ready, discard this card
   * instead" (Frozen in Time) replaces it. Pushed only when an ability could react; otherwise the card readies at once.
   */
  | {
      readonly kind: "cardReadying";
      readonly instanceId: InstanceId;
      /**
       * The card whose ability readies it, for "cannot be readied by player card effects" (Unnatural Storm;
       * docs/phase7-wave4.md §3.19). Absent for the end-of-phase ready.
       */
      readonly sourceInstanceId?: InstanceId;
    }
  /**
   * A card **has** readied (docs/phase7-wave2.md §21): "Hero Response: After you ready Quicksilver, ready this card."
   * (Friction Resistance, `qsv` 14009.) The "-ed" twin of `cardReadying`, in the same idiom as
   * `basicPowerUsing`/`basicPowerUsed`: an announcement, so it opens a response window and nothing else.
   *
   * Announced only when the ready actually changed the card from exhausted to ready — never when the card was
   * already ready, and never when RRG 1.8 "'Cannot'" (p. 11) stopped it (All Tied Up). "After you ready X" is a
   * fact about a ready that happened.
   */
  | { readonly kind: "cardReadied"; readonly instanceId: InstanceId }
  | { readonly kind: "turnStarted"; readonly playerId: PlayerId }
  /**
   * A minion engaged a player (RRG 1.8 "Engage", p. 18): it entered play in their area, was put into play engaged with
   * them, or moved to them. "After you engage a minion" (Thor). Announced after the minion's keywords (quickstrike):
   * ruling, Jan 17, 2026 (3) answer 2, "keywords have timing priority over triggered abilities".
   */
  | { readonly kind: "minionEngaged"; readonly minionInstanceId: InstanceId; readonly playerId: PlayerId }
  /** A player's turn is about to end: "Forced Interrupt: When your turn ends, discard your hand." (Hulk). The turn ends when it applies. */
  | { readonly kind: "turnEnding"; readonly playerId: PlayerId }
  /**
   * An encounter card's surge is about to resolve (its player deals themself another encounter card): "When the surge
   * keyword on an encounter card would be resolved" (Espionage). Ruling, Aug 3, 2026 (3): surge "is treated as a When
   * Revealed ability".
   */
  | { readonly kind: "surgeResolving"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * An ability resolved: it was triggered and its effects resolved (RRG 1.8 "Resolve", p. 37). "After you resolve the
   * ability of a Preparation card you control" (Black Widow; Synth-Suit too, ruling Feb 28, 2026 (2)).
   */
  | {
      readonly kind: "abilityResolved";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly controllerId: PlayerId | null;
    }
  /** A card (villain or double-sided encounter card) has flipped. An announcement: the flip has happened. */
  | { readonly kind: "cardFlipped"; readonly instanceId: InstanceId }
  /** A player changed form (by the once-per-round flip or a card effect): "after you change to this form". */
  /**
   * `fromHeroForm` / `toHeroForm`: the hero faces before and after, for an identity with more than one (a three-sided
   * identity changing between its hero forms is a change of form with `to: "hero"`; docs/phase7-wave2.md §3.2).
   */
  | {
      readonly kind: "formChanged";
      readonly playerId: PlayerId;
      /** The identity's form after the change (unchanged by an additional form change). */
      readonly to: "hero" | "alterEgo";
      readonly fromHeroForm?: number | null;
      readonly toHeroForm?: number | null;
      /**
       * `identity`: the hero/alter-ego flip. `additional`: an additional form ("[type] form" keyword; RRG 1.8 "Form,
       * Change Form", p. 21, "it does count as changing form for the purpose of triggering card effects"), with its type,
       * the name now showing and the form card as the event's target. docs/phase7-wave4.md §3.1.
       */
      readonly change: "identity" | "additional";
      readonly formType?: string;
      readonly formName?: string;
      readonly formCardInstanceId?: InstanceId;
    }
  | { readonly kind: "playerPhaseEnded" }
  | { readonly kind: "villainPhaseEnded" }
  /**
   * "When/After the [player|villain] phase begins" (docs/phase7-wave3.md §3.2): Museum Ship and Nebula's Ship (`gmw`),
   * Blazing Inferno (`gmw`), Sibling Rivalry (`gam`), Ronan the Accuser (`ron`), and 15 more in the pool. RRG 1.8 "Round
   * Overview" (p. 4) steps 1 and 4 make the phase's beginning its own point, before its first step: an interrupt and a
   * response window, then the player phase's first turn or the villain phase's step one. Pushed only when an ability is
   * listening, so every game without one logs exactly as before.
   */
  | { readonly kind: "phaseBeginning"; readonly phase: "player" | "villain" }
  /**
   * "When/After the [player|villain] phase ends" and "When/After the round ends" (docs/phase7-wave3.md §3.2). RRG 1.8
   * "End of Player Phase" (p. 18) step 5 and "Villain Phase" (p. 47) step 6b: "Resolve any 'when/after the [villain]
   * phase ends' or 'when/after the round ends' effects" — so the villain phase's end **is** the round's end, one timing
   * point, after "until the end of the phase/round" effects have ended (steps 4 and 6a). Its apply step resolves the
   * "at the end of the phase/round" delayed effects, which RRG 1.8 "Delayed Effect" (p. 15) places "immediately after
   * their specified timing point [...] and before responses". The Collector's and Hela's ∞ faces, Rogue Vessel (`gmw`),
   * Regroup (`drax`), Magical Enhancements (`drs`), the temporary keyword. Pushed only when an ability is listening.
   */
  | { readonly kind: "phaseEnding"; readonly phase: "player" | "villain" }
  /**
   * "After resolving step one of the villain phase" (docs/phase7-wave3.md §3.2): 36 printed cards, among them
   * Terrestrial Invasion 1B, Protect the Planet 2B and Bombardment (`gmw`). Announced once step one's threat and its
   * own interrupts and responses have resolved, before step two begins (RRG 1.8 "Villain Phase", p. 47). Not a
   * `placeThreat` response: that also fires on every scheme, incite and card-placed threat. Response window only.
   */
  | { readonly kind: "villainStepResolved"; readonly step: "placeThreat" }
  /**
   * A card discarded from play went to a scenario area instead (`RuleSpec discardFromPlayDestination`; The Collection,
   * docs/phase7-wave3.md §3.14): "…, then place 1 threat on the main scheme" (Collector III) responds to it. Response only.
   */
  | { readonly kind: "discardRedirected"; readonly instanceId: InstanceId; readonly area: string }
  /**
   * Damage was prevented, by the card `preventerInstanceId` (docs/phase7-wave4.md §3.20): "After Abjuration prevents 2
   * or more damage from a single attack, discard it" (Abjuration, `mts` 21082) is a forced response with `selfIs:
   * "source"`, `fromAttack: true` and `eventAtLeast: { amount: 2 }`. Announced (response only) when an ability listens,
   * for a `preventAllDamage` constant and for a `preventDamage` effect (whose card is the preventer). A tough status
   * card, a reduction and "cannot take damage" are not a card preventing damage and announce nothing.
   */
  | {
      readonly kind: "damagePrevented";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly preventerInstanceId: InstanceId | null;
      readonly fromAttack: boolean;
      /** The card dealing the damage. */
      readonly sourceInstanceId: InstanceId | null;
    };

/**
 * `results` is attached when the event's response window opens: what the event
 * actually did (`amount`, and for attacks/activations `damage`, `damaged`,
 * `defeated`, `undefended`, `threatPlaced`, `threatRemoved`).
 */
export type TriggerEvent = TriggerEventBody & { readonly results?: Vars };

export type TriggerEventKind = TriggerEvent["kind"];

/**
 * Announcement events describe a state change that the engine has already made
 * (a card moved, a stage advanced). They only open a response window — there is
 * nothing left to interrupt.
 */
export function isAnnouncement(event: TriggerEvent): boolean {
  switch (event.kind) {
    case "dealDamage":
    case "healDamage":
    case "placeThreat":
    case "removeThreat":
    case "attack":
    case "thwart":
    case "enemyAttack":
    case "enemyScheme":
    case "enemyAttacksEnemy":
    // RRG 1.8 "Defend, Defense" (p. 15) names abilities that trigger "when your hero defends against an attack"
    // (Expert Defense, Desperate Defense), and "Interrupt" (p. 25) resolves them as the triggering condition
    // initiates. The defender is recorded before this event is pushed, so the interrupt window sees it.
    //
    // The *response* side is not symmetric: RRG 1.8 p. 16, "Abilities that trigger after a character defends an
    // attack resolve after that attack ends", so this event's response window is deferred to the end of the
    // attack it belongs to rather than opened here (`resolve/event.ts`, `deferredResponses`).
    case "defended":
    case "characterAttacked":
    case "characterDefeated":
    case "encounterCardRevealing":
    case "boostCardTurnedFaceup":
    // "When boost icons on an encounter card would be counted" (docs/phase7-wave2.md §3.6): the count is still to come.
    case "boostIconsCounting":
    // "When attached character would ready" (docs/phase7-wave2.md §3.11): the ready is still to come.
    case "cardReadying":
    // "When you use one of your hero's basic powers" (§17.4): the power is still to come.
    case "basicPowerUsing":
    case "turnEnding":
    // "Forced Interrupt: When your turn begins, …" (The Poison, `gmw` 16125). A turn beginning is a timing point like a
    // phase beginning (below): RRG 1.8 "Interrupt" (p. 25) resolves an interrupt "immediately before that triggering
    // condition resolves", and nothing in the RRG makes a "begins" timing point response-only. The turn's state
    // (`beginTurn`) is set before the event is pushed, but no player action can be taken until its frame has left the
    // stack, so an interrupt still resolves before anything the turn does. Its apply step changes nothing, and
    // "After your turn begins" (Quinjet, `cap` 03019) still answers in the response window as before.
    case "turnStarted":
    case "surgeResolving":
    case "cardBeingPlayed":
    // docs/phase7-wave3.md §3.2: "When the villain phase begins/ends" are interrupts to these timing points.
    case "phaseBeginning":
    case "phaseEnding":
    // "When you spend this card" (an interrupt) and "After you spend this card" (a response) both have a window. The
    // cards are already discarded when it is pushed — every cost is paid at once (RRG 1.8 "Cost", p. 13) — so its
    // apply step changes nothing; see docs/phase7-wave2.md §12.2 for what that does and does not let an interrupt do.
    case "resourcesSpent":
    /**
     * "Forced Interrupt: When an environment enters play, …" (None Shall Pass 1A): the card is already in the play
     * area by the time this is pushed, but nothing it does *on* entering has happened yet — the enter-play keywords
     * (toughness, uses counters, the restricted and ally-limit checks) are this event's own apply step
     * (`resolve/event.ts`), so an interrupt runs before them and a response after, which is also what RRG 1.8
     * "Ally Limit" (p. 7) asks for: the check "occurs before abilities that resolve upon entering play".
     */
    case "cardEntersPlay":
    // "When this stage would be completed" (docs/phase7-wave4.md §3.4): the completion is still to come.
    case "mainSchemeCompleting":
    // "When the last lock counter is removed from here" (docs/phase7-wave4.md §3.15): the removal is still to come.
    case "countersRemoved":
      return false;
    default:
      return true;
  }
}

export interface EventSubjects {
  readonly sources: readonly InstanceId[];
  readonly targets: readonly InstanceId[];
  readonly players: readonly PlayerId[];
}

/** The cards and players an event is "about", used to match ability trigger patterns. */
export function eventSubjects(event: TriggerEvent): EventSubjects {
  const of = (
    sources: readonly (InstanceId | null)[],
    targets: readonly (InstanceId | null)[],
    players: readonly (PlayerId | null)[],
  ): EventSubjects => ({
    sources: sources.filter((id): id is InstanceId => id !== null),
    targets: targets.filter((id): id is InstanceId => id !== null),
    players: players.filter((id): id is PlayerId => id !== null),
  });

  switch (event.kind) {
    case "dealDamage":
      return of([event.sourceInstanceId], [event.targetInstanceId], []);
    case "damagePrevented":
      return of([event.preventerInstanceId], [event.targetInstanceId], []);
    case "healDamage":
      return of([], [event.targetInstanceId], []);
    case "placeThreat":
    case "removeThreat":
      return of([event.sourceInstanceId], [event.schemeInstanceId], []);
    case "attack":
      return of([event.attackerInstanceId], [event.targetInstanceId], [event.playerId]);
    case "thwart":
      return of([event.thwarterInstanceId], [event.schemeInstanceId], [event.playerId]);
    case "enemyAttack":
      return of([event.enemyInstanceId], [event.targetInstanceId], [event.attackedPlayerId, event.targetPlayerId]);
    case "enemyScheme":
      return of([event.enemyInstanceId], [], [event.playerId]);
    case "characterAttacked":
      return of([event.attackerInstanceId], [event.targetInstanceId], [event.playerId]);
    case "enemyAttacksEnemy":
      return of([event.attackerInstanceId], [event.targetInstanceId], []);
    case "defended":
      return of([event.enemyInstanceId], [event.defenderInstanceId], [event.playerId]);
    case "cardEntersPlay":
    case "cardPlayed":
    case "cardBeingPlayed":
    case "cardRevealed":
    case "encounterCardRevealing":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    // The defeating card is the event's source, so `sourceIs` reads "after [this card] defeats …"; the defeated card
    // stays the target, and the defeating player the player subject.
    case "characterDefeated":
      return of([event.sourceInstanceId ?? null], [event.instanceId], [event.defeatedByPlayerId ?? null]);
    case "schemeDefeated":
      // The defeating player, so "after *you* defeat a side scheme" reads like the `characterDefeated` case above.
      return of([event.sourceInstanceId ?? null], [event.instanceId], [event.defeatedByPlayerId ?? null]);
    case "cardFlipped":
    case "discardRedirected":
      return of([], [event.instanceId], []);
    case "mainSchemeCompleted":
    case "mainSchemeCompleting":
      return of([], [event.schemeInstanceId], []);
    case "boostIconsCounting":
      return of([event.enemyInstanceId], [event.cardInstanceId], [event.playerId]);
    case "basicPowerUsed":
    case "basicPowerUsing":
      return of([event.characterInstanceId], [event.characterInstanceId], [event.playerId]);
    case "cardReadying":
    // The readied card is the event's *target*, so "after you ready Quicksilver" is
    // `targetIs: { categories: ["identity"], controller: "you" }` — the query's own `controller` says whose ready it
    // was, which is why neither of these carries a player subject.
    case "cardReadied":
      return of([], [event.instanceId], []);
    case "boostCardTurnedFaceup":
      return of([event.enemyInstanceId], [event.boostInstanceId], [event.playerId]);
    case "countersRemoved":
      return of([], [event.instanceId], []);
    case "villainSwapped":
      return of([], [event.villainInstanceId], []);
    case "deckRanOut":
      return of([], [], [event.playerId ?? null]);
    case "formChanged":
      return of([], event.formCardInstanceId ? [event.formCardInstanceId] : [], [event.playerId]);
    case "turnStarted":
    case "turnEnding":
      return of([], [], [event.playerId]);
    case "minionEngaged":
      return of([event.minionInstanceId], [event.minionInstanceId], [event.playerId]);
    case "surgeResolving":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    case "abilityResolved":
      return of([event.instanceId], [], [event.controllerId]);
    case "resourcesSpent":
      // `forPlayerId` first, so `eventPlayer` is "that player" (Everyday Hero); the spender is "you" either way.
      return of(
        event.cardInstanceIds,
        [event.purpose === "playCard" ? event.payingForInstanceId : null],
        event.forPlayerId === event.playerId ? [event.playerId] : [event.forPlayerId, event.playerId],
      );
    default:
      return of([], [], []);
  }
}
