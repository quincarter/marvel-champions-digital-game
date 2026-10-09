import type { AbilityId, CardId, Trait } from "@mc/content";
import type { EncounterDeckId, FrameId, GameAreaId, InstanceId, PlayerId } from "./ids.js";
import type { StatusDiscardCause } from "./events.js";
import type { CardDestination, StatName, StatusName } from "./spec.js";
import type { Vars } from "./stack.js";
import type { MainSchemeAdvancedBy, StatusCounts, ZoneId } from "./state.js";

/**
 * Something that happens in the game and that abilities can hook. Every one of
 * these gets an `interrupt` window before it and a `response` window after it
 * when it resolves through the stack (RRG "Ability: Simultaneous Timing
 * Priority").
 */
/**
 * What a pattern's `targetIs` reads of an event's target as the event happened, when the event itself may have changed
 * it before an "after" ability is read (the family of `cardLeavesPlay.traits` and `characterDefeated.
 * attachedInstanceIds`). A response reads the game as its triggering condition happened: the clauses of the query this
 * carries are matched against it, every other clause against the card as it now is (`resolve/triggers.ts`).
 *
 * Carried: the names and the status cards. An absent field falls back to the live card, so events stamped before a
 * field existed stay valid.
 */
export interface TargetSnapshot {
  /** The name it was showing (`currentName`; `TargetQuery.name`). Absent for a card with none. */
  readonly name?: string;
  /** The titles (and subtitle) naming it (`titlesNaming`; `TargetQuery.titled`). */
  readonly titles: readonly string[];
  /**
   * The status cards it held as the damage was dealt (`TargetQuery.hasStatus`, `hasAnyStatus`): "After Cypher attacks
   * and damages a confused enemy" still finds the enemy confused when that damage defeated it and its status cards
   * left play with it (owner ruling 2026-10-06, docs/phase7-wave7.md §4.1). Read before the damage is applied, so a
   * tough card this damage is about to use is counted, and one a piercing attack discarded first is not.
   */
  readonly statuses?: StatusCounts;
}

export type TriggerEventBody =
  | {
      readonly kind: "dealDamage";
      readonly targetInstanceId: InstanceId;
      /**
       * The damage this event is still to deal: what it was created with, less what "prevent N of that damage"
       * interrupts have prevented and plus what "increase that damage" interrupts have added. 0 as the event is
       * created is 0 damage as it would be dealt, which opens no window at all (owner ruling 2026-10-06).
       */
      readonly amount: number;
      /**
       * The damage **dealt** (RRG 1.8 "Prevent", p. 35: "the amount of damage that character 'takes' is reduced, but
       * the amount of damage 'dealt' is not reduced"): `amount` plus everything an interrupt prevented. Written by
       * `preventDamage` the first time it takes anything off `amount`, kept in step by `increaseDamage`, and stamped on
       * every resolved event, so in an interrupt window an absent `dealt` means "`amount`, nothing prevented yet".
       * "After X deals damage / is dealt damage" reads this (owner ruling 2026-10-07, docs/phase7-wave7.md §4.1): a
       * positive amount reached the damage-dealing process, whether or not a tough status card, a prevention, a
       * constant reduction or "cannot take damage" then kept the target from taking it.
       */
      readonly dealt?: number;
      /**
       * The damage **taken**: what was placed on the target, after preventions, constant reductions and caps, a tough
       * status card and "cannot take damage". Stamped on the resolved event only (absent in the interrupt window) and
       * always equal to its `results.amount` (absent there when 0). "After X takes damage" reads it.
       */
      readonly taken?: number;
      readonly sourceInstanceId: InstanceId | null;
      /** Damage from an attack; defense, retaliate and overkill key off this. */
      readonly fromAttack: boolean;
      /** The attack/activation event frame this damage belongs to; damage/defeat results are reported there. */
      readonly parentFrameId?: FrameId | null;
      /**
       * Overkill spill (RRG 1.8 "Overkill", p. 31): the attack frame whose defeated target this excess spilled from. The
       * spill reports only its per-character `damageTaken.<instanceId>` result there (docs/phase7-wave5.md §4.1 Q65),
       * not the attack's `damage`/`damaged`/`defeated` totals, which count the attacked target's damage alone.
       */
      readonly spilledFromFrameId?: FrameId | null;
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
      /**
       * Set once this attack's piercing has resolved ahead of the damage's interrupt window (ruling January 17, 2026
       * (3) #2: a keyword has timing priority over triggered abilities): how many tough status cards it discarded. The
       * damage step announces them and does not pierce a second time.
       */
      readonly toughPierced?: number;
      /**
       * This attack has ranged, its attacker's own or granted to this attack, stamped as `piercing` is. Read by the
       * damage rules keyed to an attack's keyword ("unless … the attack has ranged", `cannotTakeDamage.
       * exceptAttackKeyword`; docs/phase7-wave7.md §3.30).
       */
      readonly ranged?: true;
      /** The card whose ability produced this damage when that isn't the source ("damage from Black Panther upgrades"). */
      readonly viaInstanceId?: InstanceId | null;
      /** An ally's consequential damage (RRG 1.8 "Consequential Damage", p. 13), so "for this use" can cancel it (§3.21). */
      readonly consequential?: true;
      /** With `consequential`: the basic power it follows, read by a rule's `ConsequentialDamageScope.from` (§3.31). */
      readonly consequentialFrom?: "attack" | "thwart";
      /**
       * Indirect damage (RRG 1.8 "Indirect Damage", p. 24): one character's assigned share, stamped where the shares
       * are dealt (`dealIndirectDamage`), whatever dealt them — an ability, a cost, or an enemy attack that deals
       * indirect damage. Read by `EventPattern.indirect` ("after a friendly character takes indirect damage").
       */
      readonly indirect?: true;
      /**
       * Attack damage dealt to a character the attack is not against ("damage from that attack is dealt to the chosen
       * enemy instead of you", Psychic Misdirection; `modifyAttack.damageTo`, docs/phase7-wave6.md §3.36 and §4.1 Q18):
       * still `fromAttack` from the attacker, but the attack's piercing and overkill and its "prevent N damage from
       * this attack" budget (all about the attacked character) do not apply to it.
       */
      readonly notAttacked?: true;
      /**
       * Damage no player deals although a player controls its source (`EffectSpec dealDamage.by` naming nobody;
       * docs/phase7-wave7.md §4.1 Q2): nothing keyed to the source's controller answers it and a defeat it causes has
       * no defeating player (`sourcePlayerOf`). What applies to any damage still applies: a tough status card absorbs it.
       */
      readonly noPlayer?: true;
      /**
       * The target as it took this damage (`TargetSnapshot`), stamped as the damage is applied, so it is absent in the
       * damage's interrupt window and present in its response window. "After Deadpool takes damage" still names him
       * when that damage turned him to his alter-ego side before the response is read (docs/phase7-wave7.md §3.79).
       */
      readonly targetAsDamaged?: TargetSnapshot;
    }
  | {
      readonly kind: "healDamage";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      /** The card whose ability heals it, read by `RuleSpec cannotBeHealed` (docs/phase7-wave6.md §3.12). */
      readonly sourceInstanceId?: InstanceId | null;
    }
  | {
      readonly kind: "placeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      readonly parentFrameId?: FrameId | null;
      /**
       * Villain phase step one with several main schemes (docs/phase7-wave5.md §4.1 Q71): every scheme's threat lands
       * before any completion is checked. `"deferred"`: this placement skips the completion check; `"closing"`: the
       * last placement of the batch checks every main scheme, even if its own amount was prevented to 0 or it was
       * cancelled. Absent everywhere else, where each placement checks as it lands.
       */
      readonly completionCheck?: "deferred" | "closing";
    }
  | {
      readonly kind: "removeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      /**
       * "The player who removed that threat" (The Search for Spiral, `mojo` 39016), and this event's player
       * (`PlayerRef eventPlayer`): the thwarting player for a thwart's removal; else the player using the ability that
       * removes it (an effects frame's `byPlayer`), whatever card it is on, so a scheme's own "Hero Action: … remove 3
       * threat from here" names the player who used it although no player controls the scheme (RRG 1.8 "Ability",
       * p. 4: "Any player can use such an ability on an encounter card"; "You, Your", p. 49: that player performs it);
       * else the player the removing card acts for (`sourcePlayerOf`: its controller, or the player an obligation or
       * an attachment on a player card speaks to). Absent or null for a removal no player makes: any other encounter
       * card's forced ability, an enemy's scheme that removes threat.
       */
      readonly playerId?: PlayerId | null;
      readonly parentFrameId?: FrameId | null;
      /** "…, ignoring any crisis icons in play": this removal skips the crisis check (RRG 1.8 "Crisis Icon", p. 14). */
      readonly ignoreCrisis?: boolean;
      /**
       * A removal no player makes although a player controls its source (`EffectSpec removeThreat.by` naming nobody;
       * docs/phase7-wave7.md §4.1 Q2): `playerId` is null and the source's controller is not read in its place
       * (`sourcePlayerOf`), so no rule on what one player may do applies and a scheme it defeats has no defeating
       * player. It is still a player card's removal: a crisis icon stops it (RRG 1.8 "Crisis Icon", p. 14).
       */
      readonly noPlayer?: true;
    }
  | {
      readonly kind: "attack";
      readonly attackerInstanceId: InstanceId;
      /**
       * The attacked character. Null only on a `labeled` or `begun` attack that began before any enemy could be named
       * (its enemy is chosen after an earlier instruction of the ability, or every enemy named was guarded): it takes
       * the first enemy an instruction attacks as its target then, and stays null if it attacks nobody.
       */
      readonly targetInstanceId: InstanceId | null;
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
       * The ability that made this attack, absent for a basic attack and for an attack no ability made: "When you use
       * your 'Optic Blast' ability" (Full Blast 33008) hears only that ability's attack, not an "(attack)" event's
       * (`EventPattern.sourceAbility`, docs/phase7-wave6.md §3.84).
       */
      readonly sourceAbilityId?: AbilityId;
      /**
       * The same attack resolved against another target ("resolve this attack against each minion engaged with that
       * player", Thor 25013; `EffectSpec resolveAttackAgainst`, docs/phase7-wave4.md §3.22): the attacker's own "when
       * it attacks" abilities don't re-trigger, as with an enemy attack's `additionalResolution`.
       */
      readonly additionalResolution?: true;
      /**
       * The attacked character as this attack's damage was dealt to it (`TargetSnapshot`), copied from that damage as
       * it is applied: absent in the attack's interrupt window (which reads the live card) and for an attack that
       * dealt its target no damage, present in its response window. So a status card the attack's own ability gave
       * before the damage counts, and one discarded before the damage does not. Damage to a character the attack is
       * not against (`notAttacked`) is not read.
       */
      readonly targetAsDamaged?: TargetSnapshot;
      /**
       * The attack an "(attack)"-labeled ability makes when it has no `attack` effect of its own (RRG 1.8 "Labeled
       * Ability", p. 26: resolving the ability "is considered to be an attack made by that player's identity"; owner
       * ruling Q48, docs/phase7-wave8.md §4.1). It deals no damage itself: it opens as the ability begins resolving,
       * before its first instruction (p. 26: "when the labeled ability begins resolving (after costs have been
       * paid)"; owner decision, 2026-10-08, row 61), and the damage of the ability's instructions is this attack's
       * (`resolve/attack-ability.ts`). `targetInstanceId` is the first enemy its first damage instruction would
       * attack, read as the attack begins, or null when none can be named yet.
       */
      readonly labeled?: true;
      /**
       * The attack of an "(attack)"-labeled ability that has an `attack` effect, begun as the ability began resolving
       * because another instruction resolves before that effect (RRG 1.8 "Labeled Ability", p. 26: "when the labeled
       * ability begins resolving (after costs have been paid)"; owner decision, 2026-10-08, row 73;
       * `resolve/attack-ability.ts`). Its interrupt window opens then. Until its `attack` instruction is reached the
       * event carries what could be read as it began: `targetInstanceId` (the enemy that instruction names if it is
       * already chosen, else null), the instruction's `keywords` and `overkill`, and `amount` 0 (the damage is not
       * known yet). The instruction then takes this event over and gives it its target, amount and keywords, so the
       * resolved event reads as any other attack's. An attack no instruction took over attacked only the enemies the
       * ability's other damage instructions named (`attacked`, always present on it).
       */
      readonly begun?: true;
      /**
       * On an "(attack)" ability's attack once it has finished: every enemy it attacked, in order, each once (RRG 1.8
       * "Attack (Player Ability Type)", p. 10: "When an attack targets multiple enemies, the attacking character is
       * considered to have attacked each of those enemies"; owner ruling Q50). These are the enemies an instruction of
       * the ability targeted, never an enemy that only lost hit points to it (an overkill spill). The event's targets
       * (`eventSubjects`, so `targetIs`, `eventTarget`) are these when present. Absent when it is exactly
       * `[targetInstanceId]`, so a one-target attack reads as it always has; always present on a `labeled` attack.
       */
      readonly attacked?: readonly InstanceId[];
    }
  | {
      readonly kind: "thwart";
      readonly thwarterInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly playerId: PlayerId;
      /**
       * Threat this thwart removes: a "(thwart)" ability's (or a divided basic thwart's share) from the start; absent
       * or null on a basic thwart until it resolves (it removes the thwarter's THW, `select.ts` `thwartAmount`). Once
       * resolved, the threat actually removed, which is what its response window sees.
       */
      readonly amount?: number | null;
      readonly basic?: boolean;
      /** A basic thwart made with ATK instead of THW (the Assault keyword, or "may use their ATK"; §3.11). */
      readonly useAtk?: boolean;
      /**
       * Every scheme of the one divided basic thwart this share belongs to, this share's own included (RRG 1.8
       * "Assault", p. 8, and docs/phase7-wave7.md §4.1 Q3: a divided basic thwart is one basic thwart). The character
       * is thwarting each of them for as long as any share is resolving, which is what `thwartInProgress` reads.
       */
      readonly dividedAmong?: readonly InstanceId[];
      /** "…, ignoring any crisis icons in play": passed to the threat removal this thwart makes. */
      readonly ignoreCrisis?: boolean;
      /** "…, ignoring the patrol keyword": this thwart is not stopped by patrol (docs/phase7-wave4.md §3.32). */
      readonly ignorePatrol?: boolean;
      readonly sourceInstanceId?: InstanceId | null;
      /**
       * This is one instance of the threat a "(thwart)" ability removes by its controller's identity: the root effects
       * frame of that ability's resolution, which carries its `ThwartSession`. The ability is a single thwart (RRG 1.8
       * "Thwart", p. 44), so only its first instance opens an interrupt window and none opens a response window; the
       * ability's one resolved `thwart` event (without this field) follows its last effect. `resolve/thwart-session.ts`.
       */
      readonly abilityFrameId?: FrameId;
      /**
       * On the resolved event of a "(thwart)" ability that removed several instances of threat: each instance in order,
       * with the threat actually removed. `schemeInstanceId` is then the first instance's scheme, `amount` the total,
       * and the event's targets (`eventSubjects`) are all of these schemes. Absent for a single instance.
       */
      readonly instances?: readonly { readonly schemeInstanceId: InstanceId; readonly amount: number }[];
      /**
       * A thwart that removes no threat: "Interrupt (thwart): When the villain schemes, reduce the amount of threat
       * placed on the scheme by 1" (Emergency 01085; owner decision, 2026-10-03). As it applies, the scheme activation
       * `activationFrameId` places `amount` less threat (its `threatBonus`); `schemeInstanceId` is the scheme that
       * activation places its threat on, and `amount` (the thwart's) is 0. See `EffectSpec modifyAttack.threatBonus`.
       */
      readonly reducesThreatPlaced?: { readonly activationFrameId: FrameId; readonly amount: number };
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
      /**
       * The player the attack was initiated against: the "you" of "**When** [enemy] attacks you" (`PlayerRef
       * attackedPlayer` with `initiated`). A declared defender never changes it.
       */
      readonly attackedPlayerId: PlayerId;
      /**
       * The attack's target player now: the attacked player until another player's hero or ally defends, or another
       * player's "(defense)" ability makes their identity the defender, and that player from then on. The "you" of
       * "**After** [enemy] attacks you" (RRG 1.8 "Defend, Defense", pp. 15-16; `EventPattern.usesAttackedPlayer`), and
       * of a constant or boost ability while the attack resolves (p. 16; `PlayerRef attackedPlayer`).
       */
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
  /**
   * `payment`: what was paid to play the card, stamped as the play is announced (the play frame's `paid.*` and
   * `overpaid.*` vars and a chosen `x`: `playPaymentVars`), so an "after you play" ability reads the payment of "that
   * event" from the event it answers, whatever has left the stack since ("remove 1 threat … for each different
   * resource type used to pay for that event", Jubilee's Coat 47004; docs/phase7-wave8.md §3.62). Absent for a play
   * that recorded no payment.
   */
  | {
      readonly kind: "cardPlayed";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly payment?: Vars;
    }
  /**
   * A card has been paid for and is about to resolve: "When you play an [Attack] event" (Embiggen!, Shrink). An
   * interrupt here happens before the card's own abilities resolve, which is what lets a modifier apply to every
   * instance of damage the event deals. `cardPlayed` stays where it is — announced after the card has resolved — so
   * "after you play" responses are unaffected. Only put on the stack when an ability could react (`heard`).
   */
  | { readonly kind: "cardBeingPlayed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly kind: "cardRevealed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * A revealed treachery (or a revealed event) has **resolved**: "After you resolve a treachery, … attach that treachery
   * facedown here" (Spider-Man Noir, `spdr` 31015). RRG 1.8 "Resolve" (p. 37): "A treachery card is resolved when it is
   * revealed and one or more of its abilities resolve"; treacheries and events are the only card types that are
   * resolved, so no other type announces it. Keyword abilities count (surge and incite are When Revealed abilities,
   * RRG 1.8 "Reveal" step 3, p. 38; "Surge", p. 42), and a card whose effects were all cancelled has not resolved
   * (RRG 1.8 "Cancel", p. 11) — FAQ "Spider-Man Noir (#15)" (RRG 1.8 p. 63): "some part of the treachery card must be
   * resolved … If no part of the treachery card resolves, he cannot attach it."
   *
   * Announced with `cardRevealed`, after reveal step 4 (the discard), so `to` is where the card went — the encounter
   * discard pile, or wherever its own When Revealed moved it — and a response can take it from there. Before any surge
   * card is revealed ("Complete the process of resolving the original card, as well as any response abilities … before
   * revealing the additional card", RRG 1.8 "Surge", p. 42). Response window only; pushed only when an ability listens.
   */
  | {
      readonly kind: "encounterCardResolved";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly to: ZoneId["kind"] | null;
    }
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
   * A player generated resources to pay a cost (docs/phase7-wave5.md §3.25): "After the engaged player generates any
   * number of resources, deal an equal amount of damage to that player's hero" (M.O.R.B.I.U.S., `spdr` 31027 errata,
   * RRG 1.8 p. 68). Response only (an announcement), pushed with `resourcesSpent` once per payment for each player who
   * generated at least 1 resource in it, when an ability listens.
   *
   * - `amount`: every resource that player generated in the payment, overpaid ones included (RRG 1.8 "Cost", p. 13:
   *   resources are generated by discarding cards from hand or using "Resource" abilities; the excess is generated and
   *   then lost) — hand cards as they counted for that card (doubled, Haywire'd), and each resource ability use. A
   *   counter spent as if it were a resource (`spentAsIfResource`, docs/phase7-wave5.md §4.1 Q5) pays but is not
   *   generated, so it adds nothing, and a payment of only those raises no event.
   * - `playerId` ("that player") is the generating player; `forPlayerId`, `payingForInstanceId` and `purpose` are as
   *   on `resourcesSpent`. The card paid for is the event's target when `purpose` is `playCard`.
   */
  | {
      readonly kind: "resourcesGenerated";
      readonly playerId: PlayerId;
      readonly amount: number;
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
      /**
       * The damage event that dealt the defeating damage, told "defeated" as well as its parent: "If that character is
       * defeated this way" after a card's own `dealDamage` (Out for Blood; docs/phase7-wave4.md §3.54), which has no
       * attack to be the parent.
       */
      readonly reportFrameId?: FrameId | null;
      readonly overkill?: {
        readonly amount: number;
        readonly toInstanceId: InstanceId;
        readonly sourceInstanceId: InstanceId | null;
        /**
         * The attack's card and its ranged keyword, carried onto the spill, which is "damage from an attack" (RRG 1.8
         * "Overkill", p. 31), so a rule reading the attack sees the same one (docs/phase7-wave7.md §3.30).
         */
        readonly viaInstanceId?: InstanceId | null;
        readonly ranged?: true;
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
       * Excess damage (RRG 1.8 "Excess Damage", p. 19): how far the damage that defeated this character went beyond its
       * remaining hit points, the value overkill would spill ("If a card ability counts excess damage dealt, that ability
       * counts the same value of excess damage that is calculated when resolving the overkill keyword", RRG 1.8
       * "Overkill", p. 31; `excessDamageOf`). From any damage (an attack, an event or ability, an indirect share, an
       * overkill spill). Absent (never 0) when there was none: exactly lethal damage, a defeat by an effect that is not
       * damage ("defeat a minion"), a sweep with no damage behind it. Prevented, reduced-away and tough-absorbed damage
       * is never taken and so never excess. Read by `ValueSpec defeatExcessDamage` (docs/phase7-wave5.md §4.1 Q68).
       */
      readonly excessDamage?: number;
      /**
       * The defeating damage was an ally's consequential damage (`dealDamage.consequential`, RRG 1.8 "Consequential
       * Damage", p. 13), from its attack or its thwart alike: "if she was defeated by taking excess consequential damage"
       * (SP//dr, `spiderham` 30021) is this with `excessDamage`, through `ValueSpec defeatExcessDamage`'s
       * `consequential` option. Absent for any other defeat.
       */
      readonly consequential?: true;
      /**
       * The cards attached to the character when its defeat was initiated ("is defeated", before any interrupt), set as
       * the event goes on the stack (`eventFrame`). By its response window the character has left play and a card
       * like Death-Glow has set itself aside, so "After the enemy with Death-Glow is defeated" (Flight of the
       * Valkyrior, 25008) reads this, through `EventPattern.targetHadAttachment` (docs/phase7-wave4.md §3.22).
       * Absent when nothing was attached.
       */
      readonly attachedInstanceIds?: readonly InstanceId[];
      /**
       * For a villain's defeat, the printed number of the stage that was defeated (`VillainStage.stageNumber`), read as
       * the defeat is initiated. By the response window the villain shows its next stage, so "after [villain] (II) is
       * defeated" reads this, through `EventPattern.eventAtLeast` / `eventAtMost` (docs/phase7-wave7.md §3.34). Absent
       * for any other character.
       */
      readonly villainStageNumber?: number;
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
  | {
      readonly kind: "mainSchemeAdvanced";
      readonly stageIndex: number;
      readonly schemeInstanceId?: InstanceId;
      /** What advanced it (`MainSchemeState.advancedBy`, docs/phase7-wave7.md §3.12); absent only in an older save. */
      readonly advancedBy?: MainSchemeAdvancedBy;
    }
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
   *
   * "After the encounter deck resets" (Wheel of Genres, `mojo` 39026a; docs/phase7-wave6.md §3.60) is an encounter
   * deck, `deckId` naming which (The Wrecking Crew has one per villain): it resets at the move that empties it (RRG 1.8
   * "Encounter Deck", p. 17), the acceleration token is placed, and this is announced after both.
   */
  | {
      readonly kind: "deckRanOut";
      readonly deck: "player" | "scenario" | "encounter";
      readonly playerId?: PlayerId;
      readonly name?: string;
      readonly deckId?: EncounterDeckId;
    }
  /**
   * Counters are removed from a card by an effect (docs/phase7-wave4.md §3.15): "When the last lock counter is removed from
   * here" (Holding Cell, `aos` 50105a, an interrupt), "After the last invocation counter is removed from Fireball"
   * (`mts` 21076–21079), "After the last power counter is removed from here" (Phoenix Force, `phoenix` 34002a).
   * `remaining` is what the card will hold after the removal (`eventAtMost: { remaining: 0 }` is "the last"). Pushed
   * only when an ability listens; its apply step removes them (so the uses keyword's discard follows).
   *
   * `paidAsCost`: removed by a counter cost (`AbilityCost.spendCounters`; "Remove 1 power counter from Phoenix Force →",
   * docs/phase7-wave6.md §3.85). A cost is paid at once (RRG 1.8 "Cost", p. 13), so the counters are already gone when
   * it is pushed: an announcement, response only, whose apply step removes nothing. Its responses resolve before the
   * paid-for ability's effects, as the cost's other announcements do (RRG 1.8 "Cost Arrow Icon", p. 14).
   */
  | {
      readonly kind: "countersRemoved";
      readonly instanceId: InstanceId;
      readonly counterType: string;
      readonly amount: number;
      readonly remaining: number;
      readonly paidAsCost?: true;
    }
  /**
   * Counters were placed on a card (docs/phase7-wave6.md §3.2): "After you place a magnet counter on this scheme"
   * (Asteroid M, Factory Online, The Rule of Magnus, `mut_gen` 32141b–32143b, errata RRG 1.8 p. 68), "After a power
   * counter is placed here" (Phoenix Force, `phoenix` 34002b). An announcement (response only), pushed by `EffectSpec
   * addCounters` once per target and by `moveCounters` once per type moved onto its target, and only when an ability
   * listens. One event per placement with `amount` the number placed (§4.1 Q8): six placed at once is one event, so
   * "if there are at least 3 … remove 3" checks once and leaves 3. `playerId` is the player resolving the placing
   * ability ("you"), null when none does. `counterType` is the type as stored on the card: an all-purpose counter has
   * already taken the card's type (ruling, Jan 26, 2026 (2)), which the placing card's script names.
   *
   * `paidAsCost`: placed by a counter cost (`AbilityCost.placeCounters`; "place 1 charge counter on Gambit →",
   * docs/phase7-wave6.md §3.53), already on the card when announced; `playerId` is then the paying player.
   */
  | {
      readonly kind: "countersPlaced";
      readonly targetInstanceId: InstanceId;
      readonly counterType: string;
      readonly amount: number;
      readonly playerId: PlayerId | null;
      readonly paidAsCost?: true;
    }
  /**
   * A status card was discarded from a card (docs/phase7-wave6.md §3.5): "After a tough status card is discarded from
   * Colossus" (Iron Will, Organic Steel, `mut_gen` 32004, 32006). An announcement (response only), one per status card,
   * from every path that discards one: a tough card used up by damage (RRG 1.8 "Tough", p. 44), piercing, a stun or
   * confuse spent, an effect, a status the card can no longer have (stalwart, `cannotHaveStatus`). Several discarded by
   * one step (piercing on two tough cards) share one response window (§4.1 Q5), so a response with no limit answers
   * each and one that exhausts its card answers once. Pushed only when an ability listens; a status that was never
   * held (a `cannotHaveStatus` refusal) announces nothing.
   */
  | {
      readonly kind: "statusDiscarded";
      readonly instanceId: InstanceId;
      readonly status: StatusName;
      readonly cause: StatusDiscardCause;
    }
  /**
   * A status card was placed on a character (docs/phase7-wave7.md §3.27): "Forced Response: After a status card is
   * placed on Mister Sinister" (`next_evol` 40136–40138). The mirror of `statusDiscarded`: an announcement (response
   * only), one per status card that actually lands, from every path that gives one, since all of them go through
   * `giveStatus`: an effect or a cost, the toughness keyword (RRG 1.8 "Toughness", p. 45: "Forced Response: After this
   * character enters play, give it a tough status card"), a constant's refill (`RuleSpec keepsGivingStatus`). A give the
   * character cannot hold places nothing and announces nothing: it already has one (RRG 1.8 "Status Cards", p. 41: "A
   * character cannot have more than one status card of each type at a time"; steady and `statusLimit` raise that), or
   * it is stalwart or "cannot be stunned" (p. 40; "Stun, Stunned", p. 41: "stunned status cards cannot be placed on that
   * character"). The card is already on the character when announced. Those placed by one step (one effect stunning
   * two enemies, a steady character given two) share one response window, as `statusDiscarded`'s do (wave 6 §4.1 Q5).
   * Pushed only when an ability listens. No effect moves a status card from one character to another today; one that
   * did would take it off the first (`statusDiscarded` is not that: nothing is discarded) and has to put it on the
   * second through `giveStatus`, so it would be announced as a placement there, as counters moved onto a card are
   * (`countersPlaced`, wave 6 §3.2), and refused there by the same capacity rule.
   *
   * `sourceInstanceId` is the card whose ability, cost, keyword or constant placed it (the character itself for its
   * own toughness; null when no card did). `playerId` is the player whose ability placed it ("you"): the one using the
   * ability or paying the cost, as `removeThreat.playerId` reads it, so null for an encounter card's forced ability, a
   * keyword and a constant.
   */
  | {
      readonly kind: "statusPlaced";
      readonly instanceId: InstanceId;
      readonly status: StatusName;
      readonly sourceInstanceId: InstanceId | null;
      readonly playerId: PlayerId | null;
    }
  /**
   * A character's hit points were reset (docs/phase7-wave6.md §3.67): "Forced Response: After MaGog's hit points are
   * reset" (Jolt of Adrenaline, Surge of Aggression, `mojo` 39005, 39006). An announcement (response only), pushed by
   * `EffectSpec setRemainingHitPoints` once per character it sets to its maximum hit points (no damage left), and only
   * when an ability listens. A dial set below the maximum is not a reset, and neither is a villain's next stage.
   */
  | { readonly kind: "hitPointsReset"; readonly instanceId: InstanceId }
  /**
   * An ability attached a card to a host (docs/phase7-wave8.md §3.61): "Forced Response: After you attach a [named]
   * upgrade to an enemy, take 1 damage." An announcement (response only), pushed by the one way an ability attaches a
   * card (`attachCard`: the `attach` effect, `findCard`'s `{ attachTo }`, an attach cost) once per card that landed on
   * a new host, already attached, and only when an ability listens. A card already on that host did not move and
   * announces nothing. `playerId`: the player resolving the ability or paying the cost ("you attach"), null for an
   * encounter card's ability with no player. Not announced for a card played or revealed onto the host its own
   * "attach to" names: that card enters play (`cardEntersPlay`), and RRG 1.8 "Attach To" (p. 8) keeps the two apart
   * ("the 'attach to' phrase on a card is not resolved if another ability causes that card to attach").
   */
  | {
      readonly kind: "cardAttached";
      readonly instanceId: InstanceId;
      readonly hostInstanceId: InstanceId;
      readonly playerId: PlayerId | null;
    }
  /**
   * A character ignored a guard or patrol keyword, or a crisis icon, that would otherwise have stopped the attack or
   * thwart it just made (docs/phase7-wave6.md §3.8, §4.1 Q6): "After you ignore the guard or patrol keyword on a minion"
   * (Acute Control, `mut_gen` 32034), "After you ignore the crisis icon on a scheme" (Intangible Interference, 32035).
   * One per card ignored (`cardInstanceId`: the guard or patrol minion, or the card showing the crisis icon), recorded
   * as the attack or threat removal applies and announced (response only) once that attack or thwart has finished.
   * Waived by a `characterIgnores` rule or by the thwart's own "ignoring the patrol keyword / any crisis icons".
   * Nothing is recorded for an attack or thwart that was cancelled or whose threat removal was stopped anyway. Pushed
   * only when an ability listens; several from one attack or thwart share one response window.
   *
   * `"retaliate"` (docs/phase7-wave7.md §3.30): an attacker's `characterIgnores` waived the attacked character's
   * retaliate, which would otherwise have dealt it damage (both still in play once the attack resolved, retaliate
   * above 0, and the attack without ranged, which ignores retaliate by itself). `cardInstanceId` is the attacked
   * character; `playerId` is the attacker's controller, null for an enemy.
   */
  | {
      readonly kind: "keywordIgnored";
      readonly characterInstanceId: InstanceId;
      readonly playerId: PlayerId | null;
      readonly ignored: "guard" | "patrol" | "crisis" | "retaliate";
      readonly cardInstanceId: InstanceId;
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
   * A main scheme stage turns from its A side to its B side (docs/phase7-wave8.md §4.1 Q56; RRG 1.8 Appendix II step
   * 12b, p. 51, and "Main Scheme" advance step 3, p. 27). Pushed behind the A side's own Setup / When Revealed frames.
   * Its apply step makes the B side the faceup one (`MainSchemeState.faceupSide`), so that side's abilities are live
   * from then on, and puts the B side's `resolve` abilities on the stack in that order, resolved by `playerId`.
   */
  | {
      readonly kind: "mainSchemeTurnsToB";
      readonly schemeInstanceId: InstanceId;
      readonly stageIndex: number;
      readonly resolve: readonly ("setup" | "whenRevealed")[];
      readonly playerId: PlayerId;
    }
  /**
   * An enemy **would** activate (docs/phase7-wave5.md §3.2): "Hero Interrupt: When an enemy would activate, cancel that
   * activation" (Web Binding, `sm` 27006); "Forced Interrupt: When a villain would activate, if no villain is in play,
   * resolve this card's 'Ambush!' ability. Continue that activation." (Sinister Synchronization 1B / Sinister Beatdown
   * 2B, 27100b/27101b). Pushed after the status check (a stun or confuse replaces the activation first, FAQ "Norman
   * Osborn (#1A)", RRG 1.8 p. 58) and only when an ability listens. `enemyInstanceId` is null for the villain's step-2
   * activation with no villain in play. Its apply step initiates the attack or scheme; a cancelled one never happens.
   */
  /**
   * An acceleration token was placed on this card (docs/phase7-wave5.md §3.4): "Forced Response: After an acceleration
   * token is placed on this scheme, deal 3 indirect damage to the first player." (Hapless Pedestrians 1B, `sm` 27064b).
   * Response only; pushed by `addAccelerationToken` only when an ability listens.
   */
  | { readonly kind: "accelerationTokenPlaced"; readonly instanceId: InstanceId }
  /**
   * An encounter card left a player's deck: drawn into the hand, or discarded (docs/phase7-wave5.md §3.5). Maze of
   * Mirrors / Edge of Reality (`sm` 27087, 27088): "Forced Interrupt: When you would draw or discard an encounter card
   * from your deck, deal it to yourself as a facedown encounter card → draw 1 card." Announced between frames after the
   * draw or discard is done (MC27 p. 21 FAQ), with an interrupt window whose replacement is `dealAsEncounterCard`. Always
   * pushed: its apply step deals a card nothing replaced facedown to that player, who draws 1 card, the printed handling
   * as the engine's fallback (`dealUnhandledEncounterCard`, §4.1 Q4). An obligation drawn goes to the play area as before.
   */
  | {
      readonly kind: "encounterCardFromPlayerDeck";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly how: "draw" | "discard";
    }
  /**
   * A card entered a player's hand from anywhere else (docs/phase7-wave6.md §3.10): drawn, searched for, returned from
   * play, moved there by an effect. "Forced Response: After this card enters your hand, …" (Infiltration, Shapeshifter
   * Surprise, `mut_gen` 32082-32083; MC32 p. 7: "If one of these treachery cards subsequently enters your hand, trigger
   * its Forced Response at that time"). `playerId`: whose hand ("you"); `from`: the zone it came from. Response only:
   * the card is already in the hand. Recorded by `settlePlayerDecks` only when an ability in the registry listens, and
   * announced between frames after any `encounterCardFromPlayerDeck` of the same draw has resolved, so a card that draw's
   * fallback dealt away is no longer in the hand to answer it.
   */
  | {
      readonly kind: "cardEntersHand";
      readonly playerId: PlayerId;
      readonly instanceId: InstanceId;
      readonly from: ZoneId["kind"] | null;
    }
  /**
   * A card was discarded from the top of a player's deck (docs/phase7-wave7.md §3.55): "Response: After this card is
   * discarded from the top of your deck, shuffle it back into your deck" / "add it to your hand" / "put her into play
   * under your control" (`next_evol` 40043, 40060, 40057), read from the card itself in the discard pile
   * (`AbilityDefinition.activeIn: "discard"`), and "After you discard a card from the top of your deck, attach that
   * card facedown here" (40045) on a card in play. `playerId`: whose deck ("you", whoever's card did the discarding);
   * `instanceId`: the card ("this card" / "that card", `eventTarget`); `sourceInstanceId`: the card whose effect or
   * cost discarded it, null when none is named.
   *
   * Which discards (owner decision, 2026-10-05, §4.1 Q31): any effect or cost that moves a card from a player's deck to
   * that player's discard pile, one event per card, in discard order: a player card's effect, a "discard the top card
   * of your deck →" cost, an encounter card's "discard the top 5 cards of your deck", a "discard until" loop. Every
   * such move is recorded by `recordDeckDiscard` (`resolve/deck-discard.ts`). A card discarded from a hand or from
   * play, and a card discarded from an encounter deck, is not one. `fromTop` is always true: a player deck is only
   * discarded from off its top, or from the top cards an effect has just looked at, which are the top of the deck
   * while they are looked at.
   *
   * Response only: the card is already in the discard pile. Recorded only when an ability in the registry listens, and
   * announced between frames, so the cards one effect or cost discarded share one response window (RRG 1.8 "Triggering
   * Condition", p. 45) that resolves before the discarding ability's next effect. A response that takes the card away
   * leaves nothing for another to act on: once the card is no longer where the discard put it, nothing more is offered
   * for it (`deckDiscardStillThere`), and the discarding ability no longer counts it (ruling, April 30, 2026 - Ruling
   * 4, answer 1; §4.1 Q32; `settleDeckDiscards`).
   *
   * `at`: where the discard left the card. `"discard"`: the player's discard pile. `"deck"`: the discard emptied the
   * deck, whose reset shuffled this card into the new deck at once (RRG 1.8 "Player Deck", p. 33; MC40 p. 21: "Player
   * decks reset as soon as they are empty, so Domino's deck is reset with Jackpot shuffled into it"). The response
   * still resolves, on the card in the new deck (owner decision, 2026-10-05, §4.1 Q33): "add it to your hand" and "put
   * her into play" take it from there. A "shuffle it back into your deck" has already been done by the reset (MC40
   * p. 21), which its pattern says with `eventIs: { at: "discard" }`.
   */
  | {
      readonly kind: "cardDiscardedFromDeck";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly fromTop: true;
      readonly sourceInstanceId: InstanceId | null;
      readonly at: "discard" | "deck";
    }
  /**
   * A card leaves play (docs/phase7-wave5.md §3.13): "Interrupt: When Spider-Man leaves play, …" (`sm` 27017,
   * Ghost-Spider 27048) and "Response: After a [Web-Warrior] ally leaves play, …" (Web of Life and Destiny 27023, Warrior
   * of the Great Web 30029). RRG 1.8 "Leaves Play" (p. 27) covers defeat, discard, the victory display, returning to hand
   * or deck and removal from the game. Only pushed when an ability listens.
   *
   * Two shapes (wave 5 §4.1 Q17: RRG 1.8 "Interrupt", p. 25; ruling Jan 17, 2026 (1) #2):
   * - with `leaving`: pushed by `leavePlay` *before* the move, when some interrupt hears it. The card is still in play,
   *   with its attachments, counters and controller, while the interrupt window runs; the apply step performs the move
   *   `leaving` describes (`applyLeavingPlay`) and the responses see the card gone. A replacement ("… instead") cancels
   *   the event and moves the card itself; that move is announced after the "cancelled" line (§4.1 Q34). The
   *   attachments leaving with it wait with it (`leaving: withHost`, §4.1 Q32), and every card leaving from one step
   *   shares one interrupt window and one response window (§4.1 Q33).
   * - without it: recorded by `leavePlay` after the move (`pendingLeftPlay`) and announced between frames, when no
   *   interrupt heard it before the move; its interrupt window, if any, is late. `interruptsResolved` marks a card that
   *   left during its own leaving's interrupt window (a replacement's move): only the responses open.
   *
   * Either way the event carries what the card was while still in play — `cardId`, `controllerId` and `traits` (granted
   * ones included) — and a trigger's `targetIs` trait clauses read `traits`. `to` is where it went (with `leaving`: where
   * it is going, until the apply step sets where it went). The card's own abilities answer the responses from wherever
   * it went (`leftCardCandidates`).
   */
  | {
      readonly kind: "cardLeavesPlay";
      readonly instanceId: InstanceId;
      readonly cardId: CardId;
      readonly controllerId: PlayerId | null;
      /**
       * For a card no player controlled: the player its "you" named while it was in play (`uncontrolledYouOf`), the one
       * whose play area held the obligation or whose card the attachment was on (RRG 1.8 "Obligation", p. 30;
       * "Attachment", p. 8). The event's player when there is no controller ("After a player discards an obligation,
       * that player …", Mojo in the Middle `mojo` 39060), and who the card's own leaves-play abilities resolve as.
       * Absent for a controlled card and for one that spoke to no player (a minion, a scheme).
       */
      readonly speakerId?: PlayerId;
      readonly to: ZoneId["kind"];
      readonly traits: readonly Trait[];
      /**
       * The attachments that stay in play, unattached, once this card has left: a player's permanent or "cannot leave
       * play" card on it (RRG 1.8 "Permanent", p. 32; "Attach To", p. 8). Read while it was still in play. To each of
       * them this event's card is still "attached [card]" (`hostOfSelf`, `TargetRef host`), so "After attached enemy
       * leaves play, set this card aside" on a permanent upgrade hears its former host leave (docs/phase7-wave8.md
       * §3.61). Absent when there is none.
       */
      readonly strandedAttachments?: readonly InstanceId[];
      readonly leaving?: LeaveRequest;
      readonly interruptsResolved?: true;
    }
  /**
   * A boost card has been resolved for an activation — its Boost ability done and its icons counted — and is about to be
   * discarded (docs/phase7-wave5.md §3.5). Mysterio I–III (`sm` 27084–27086): "Forced Response: After you resolve a boost
   * card during Mysterio's activation, place that card in your discard pile / on the bottom of your deck / on the top of
   * your deck if it has the [Illusion] trait." Response only, pushed only when an ability listens; a card a response
   * moved is not then discarded.
   */
  | {
      readonly kind: "boostCardResolved";
      readonly enemyInstanceId: InstanceId;
      readonly boostInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  | {
      readonly kind: "enemyActivating";
      readonly enemyInstanceId: InstanceId | null;
      readonly activation: "attack" | "scheme";
      readonly playerId: PlayerId;
    }
  /**
   * A boost card's icons are about to be counted for an activation (docs/phase7-wave2.md §3.6): "When boost icons on an
   * encounter card would be counted" (Chaos Control) and "increase or decrease the number of boost icons on that card by
   * 1 for this count" (Scarlet Witch's Crest) interrupt it with `replaceBoostCount` / `adjustBoostCount`. Announced only
   * when an ability could react.
   *
   * A count made by a card effect (`EffectSpec countBoostIcons`: "take damage equal to the number of boost icons on
   * that card", "for each boost icon discarded this way") is the same event with `enemyInstanceId: null`, one per
   * encounter card counted (docs/phase7-wave2.md §4 Q8: both cards say "on an encounter card", not "on a boost
   * card"). `playerId` is then the player resolving the counting effect, null when it has none. An interrupt's
   * `replaceBoostCount` / `adjustBoostCount` is recorded on the event itself (`countFrom`, `countAdjust`), and the
   * number counted is stamped on it as it applies (`counted`), so the log carries why the count is what it is.
   */
  | {
      readonly kind: "boostIconsCounting";
      readonly enemyInstanceId: InstanceId | null;
      readonly cardInstanceId: InstanceId;
      readonly playerId: PlayerId | null;
      /** Effect counts only: "count the number of boost icons on that card instead" (`replaceBoostCount`). */
      readonly countFrom?: InstanceId;
      /** Effect counts only: "increase or decrease … by 1 for this count" (`adjustBoostCount`), summed. */
      readonly countAdjust?: number;
      /** Effect counts only: the icons counted, floored at 0. Set as the event applies. */
      readonly counted?: number;
    }
  /**
   * A character used a basic power (docs/phase7-wave2.md §3.11): "After you use a basic power" (Quicksilver's Super
   * Speed; Captain Marvel ally 04032). FAQ "Quicksilver (#1A)" (RRG 1.8 p. 61): a stunned attack or a
   * confused thwart "is not considered to have used a basic power", so it is announced only once the power resolves.
   * Announced only when an ability could react. The *interrupt* side of the same moment is `basicPowerUsing`.
   *
   * `stat`: the stat powering this use, which is not always the power's own (docs/phase7-wave8.md §4.1 Q54). A basic
   * thwart against a scheme with assault, or one a rule lets the character make with ATK, is `power: "thwart"` with
   * `stat: "atk"` (RRG 1.8 "Assault", p. 8); "uses their THW instead of their ATK" makes an attack `stat: "thw"`, and
   * "use its ATK instead of its DEF" a defense `stat: "atk"`. Otherwise THW, ATK, DEF or REC by the power. A
   * substitution made while the event waits on the stack rewrites it (`setBasicPowerStat`), so a card reads the stat
   * here and never infers it from the power's name.
   */
  | {
      readonly kind: "basicPowerUsed";
      readonly characterInstanceId: InstanceId;
      readonly power: "attack" | "thwart" | "defense" | "recover";
      readonly stat: StatName;
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
   * A basic recovery pushes it too, on top of its `basicRecovery` event (docs/phase7-wave6.md §3.40). Recovery is an
   * alter-ego power (RRG 1.8 "Recover, Recovery", p. 36), so the Hero Interrupts that name no power never see it.
   *
   * `stat`: the stat powering this use (see `basicPowerUsed`): what `modifyBasicPower` adds to, and what
   * `Predicate basicPowerStatIs` and `eventIs: { stat }` read.
   */
  | {
      readonly kind: "basicPowerUsing";
      readonly characterInstanceId: InstanceId;
      readonly power: "attack" | "thwart" | "defense" | "recover";
      readonly stat: StatName;
      readonly playerId: PlayerId;
    }
  /**
   * The healing of a basic recovery (docs/phase7-wave6.md §3.40): its apply step heals the identity by its REC as it
   * is then. "When you make a basic recovery, discard this card instead of healing damage" (Death Factor, 35030) is an
   * interrupt that replaces this event, which replaces the healing only (§4.1 Q20): the identity is exhausted already
   * and `basicPowerUsed { power: "recover" }`, beneath this frame, still announces the recovery. Pushed only when an
   * ability could react to it or to its `basicPowerUsing`; otherwise the command heals at once as before.
   */
  | {
      readonly kind: "basicRecovery";
      readonly characterInstanceId: InstanceId;
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
  /**
   * A card (villain or double-sided encounter card) has flipped. An announcement: the flip has happened.
   *
   * `playerId`: the player whose effect flipped the card, the "you" of the effect or cost that turned it ("After you
   * flip to this side", Pursued by the Past side B, `aoa` 45075b; docs/phase7-wave8.md §2.5, §3.6). It is the event's
   * player subject, so an uncontrolled card's Forced Response to its own flip resolves as that player. Absent when the
   * flip had no "you" (an effect resolved with no player).
   */
  | { readonly kind: "cardFlipped"; readonly instanceId: InstanceId; readonly playerId?: PlayerId }
  /**
   * A player's identity is about to change form (the hero/alter-ego flip, or a change between hero faces): "Interrupt:
   * When you change to hero form, …" printed on the face being left, which is still the face showing while this
   * event's interrupt window is open. The "would" twin of `formChanged`, as `cardReadying` is to a ready: its apply
   * step makes the change (`setForm`) and announces `formChanged`. Pushed only when an interrupt listens for it
   * (`changeIdentityForm`); otherwise the identity turns at once, as it did before this event existed. Interrupt-only:
   * "after you change form" answers `formChanged`.
   *
   * An additional cost to change form (`RuleSpec formChangeCost`) is paid before this event resolves: RRG 1.8
   * "Initiating Abilities" (p. 24), costs are paid (step 5) before the change becomes imminent, so the order is cost,
   * this interrupt window, the change, then `formChanged`.
   *
   * `to`, `change` and `identityInstanceId` read as on `formChanged` (the identity is the event's target). An additional
   * form change ("[type] form") has no such window.
   */
  | {
      readonly kind: "formChanging";
      readonly playerId: PlayerId;
      readonly to: "hero" | "alterEgo";
      readonly change: "identity";
      readonly identityInstanceId: InstanceId;
      /** The once-per-round player action, which this change uses up (`setForm`). */
      readonly voluntary: boolean;
      /** The hero face changed to, for an identity with more than one. */
      readonly heroFormIndex: number;
    }
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
      /**
       * `identity` changes: the identity card that flipped, the event's target, so "When a character flips … move all
       * threat from that character" (MojoMania 1B, `mojo` 39025b) names it as `eventTarget` (docs/phase7-wave6.md
       * §3.59, §4 Q34: a hero's change of form is a flip, RRG 1.8 "Flip", p. 20).
       */
      readonly identityInstanceId?: InstanceId;
      /**
       * `identity` changes: the identity's traits just before the change, printed and granted (copied ones included,
       * docs/phase7-wave6.md §3.50), read from the face it changed away from. "After a MUTANT alter-ego changes into hero
       * form" (Moira MacTaggert, `rogue` 38018) is asked once the identity shows its hero face, which may not have the
       * trait; a pattern's `targetIs` trait clauses read these as they read `cardLeavesPlay.traits` (docs/phase7-
       * wave6.md §3.56). Absent for an additional form change (its target is the form card).
       */
      readonly fromTraits?: readonly Trait[];
    }
  /**
   * A named moment a script raised (`EffectSpec raiseMoment`, docs/phase7-wave8.md §3.39): "After you resolve a mission
   * attempt". An announcement (`isAnnouncement`): what the name stands for has already happened, so it opens a response
   * window and no interrupt window. `playerId` is "you", `sourceInstanceId` the card whose effect raised it. A pattern
   * names the moment with `eventIs: { name }`.
   *
   * `carried` / `carriedVars`: the slots `raiseMoment.carry` named and their vars, by the raising ability's own names
   * (docs/phase7-wave8.md §3.71); absent when it named none. An answering ability reads them as `moment.<slot>`
   * (`carriedByEvent`).
   */
  | {
      readonly kind: "momentRaised";
      readonly name: string;
      readonly playerId: PlayerId;
      readonly sourceInstanceId: InstanceId | null;
      readonly carried?: Readonly<Record<string, readonly InstanceId[]>>;
      readonly carriedVars?: Readonly<Record<string, number>>;
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
   * "At the start of step three of the villain phase (deal encounter cards)" (Wheel of Genres, Stopped, `mojo` 39026b;
   * docs/phase7-wave6.md §3.61). RRG 1.8 "Villain Phase" (p. 47) step 3: "Deal one encounter card to each player."
   * Announced once step two has finished and before step three deals anything, when an interrupt listens; the step's
   * own deal (one card each, then the hazard icons') follows the frame and reads the encounter deck and the icons in
   * play as the interrupt left them. Cards the interrupt deals are not that deal. Interrupt window only: nothing
   * printed answers "after step three starts", and its apply step changes nothing.
   */
  | { readonly kind: "villainStepStarting"; readonly step: "dealEncounterCards" }
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
 * `defeated`, `undefended`, `threatPlaced`, `threatRemoved`, and one
 * `damageTaken.<instanceId>` per character that took damage, `damageTakenKey`). A `removeThreat` that took its scheme
 * from some threat to none records `lastThreatRemoved` (docs/phase7-wave7.md §3.34). An enemy attack that reached its
 * damage step records `totalAtk` (`TOTAL_ATK_RESULT`).
 */
export type TriggerEvent = TriggerEventBody & { readonly results?: Vars };

/**
 * The result key an enemy attack records "its total ATK for that attack" under (docs/phase7-wave8.md §3.81): the
 * enemy's ATK as the attack's damage step read it (constant modifiers and "+N ATK for this attack" included; a printed
 * dash is an unmodifiable 0) plus the boost icons counted for it, before the defender's DEF (RRG 1.8 "Attack (Enemy
 * Activation)" step 4, p. 9). Absent (read as 0) for an attack that never reached that step: a stunned enemy, a
 * cancelled attack. The result `damage` is what the attack then dealt.
 */
export const TOTAL_ATK_RESULT = "totalAtk";

/**
 * The result key an attack/activation records one character's damage taken under (docs/phase7-wave5.md §4.1 Q65):
 * every share of its damage the character actually took, an indirect attack's assignment and an overkill spill
 * included, after prevention, reductions and tough. Summed if the character took damage from it more than once.
 */
export const damageTakenKey = (instanceId: InstanceId): string => `damageTaken.${instanceId}`;

export type TriggerEventKind = TriggerEvent["kind"];

/**
 * The move a `cardLeavesPlay` event with an interrupt window performs when it applies (docs/phase7-wave5.md §4.1 Q17),
 * as plain data so the stack stays serializable and replayable: the `leavePlay` call that waited (`zone`, with `patch`
 * for what its caller sets on the card afterwards), one card of a `moveCards` effect, an ally's or minion's defeat
 * (`defeatFromPlay`: Victory X, "instead of discarding it"), or an attachment leaving with its host (`withHost`).
 *
 * `sourceCardId`: the card whose ability makes the card leave, if any, for the Permanent keyword's same-set exception
 * (RRG 1.8 "Permanent", p. 32; `effects.ts` `permanentStopsLeaving`, docs/phase7-wave5.md §4.1 Q46). Absent for a move
 * the game's rules make.
 */
export type LeaveRequest =
  | {
      readonly kind: "zone";
      readonly zone: ZoneId;
      readonly position: "top" | "bottom";
      readonly discarded: boolean;
      readonly patch?: LeavePatch;
      readonly sourceCardId?: CardId;
    }
  | {
      readonly kind: "moveCards";
      readonly destination: CardDestination;
      readonly into?: PlayerId;
      readonly sourceCardId?: CardId;
    }
  | { readonly kind: "defeat"; readonly insteadTo?: CardDestination; readonly sourceCardId?: CardId }
  /**
   * A swap's outgoing card (`EffectSpec swapCards`, docs/phase7-wave6.md §3.47): once its interrupts resolve, the swap
   * with `with` completes (`swapCards` again), taking the out-of-play card's place as that card enters play in its own.
   */
  | { readonly kind: "swap"; readonly with: InstanceId; readonly sourceCardId?: CardId }
  /**
   * An attachment (or Victory X upgrade) leaving play because its host `host` does (§4.1 Q32): its interrupts share
   * the host's window, and its host's move takes it (`leaveNow` records where in `moved`). `step`: the host has no
   * leaving of its own on the stack (a villain removed or set aside, a main scheme stage removed or flipped), so this
   * frame's apply step performs the host's change, which takes the attachments with it.
   */
  | {
      readonly kind: "withHost";
      readonly host: InstanceId;
      readonly step?: HostStep;
      readonly moved?: ZoneId["kind"];
    };

/**
 * A change to a card that is not itself leaving play but takes its attachments out of play, as plain data so that it
 * can wait on the stack for the attachments' "when this leaves play" interrupts and then run (docs/phase7-wave5.md §4.1
 * Q32; `waitsForHostStep`, `runHostStep`). Each names the engine function that makes the change.
 */
export type HostStep =
  | { readonly kind: "removeVillains"; readonly ids: readonly InstanceId[] }
  | { readonly kind: "setVillainsAside"; readonly ids: readonly InstanceId[] }
  | { readonly kind: "removeMainSchemeStage"; readonly schemeId: InstanceId }
  /** `advanceMainScheme`: the old stage is removed from the game with its attachments (RRG 1.8 "Main Scheme", p. 27). */
  | {
      readonly kind: "advanceMainScheme";
      readonly schemeId: InstanceId;
      readonly nextIndex: number;
      readonly advancedBy: MainSchemeAdvancedBy;
    }
  /** `joinGameArea`, whose first change removes the joining area's own stage (docs/phase7-wave5.md §4.1 Q50). */
  | { readonly kind: "joinGameArea"; readonly fromId: GameAreaId; readonly intoId: GameAreaId | null }
  /**
   * `flipMainSchemeStage`; `reveal`: on completion (its frames pushed), else a "flip this card" (`cardFlipped` after).
   * `flippedBy`: the player whose effect flipped it (`cardFlipped.playerId`), when it had one.
   */
  | {
      readonly kind: "flipMainSchemeStage";
      readonly schemeId: InstanceId;
      readonly reveal: boolean;
      readonly playerId: PlayerId;
      readonly flippedBy?: PlayerId;
    }
  /**
   * `setForm` for a separated identity whose other card flips with it and discards what the identity cannot take
   * (`separatedFlipWaits`, docs/phase7-wave5.md §4.1 Q50); its `formChanged` announcement follows the change.
   */
  | {
      readonly kind: "setForm";
      readonly playerId: PlayerId;
      readonly to: "hero" | "alterEgo";
      readonly voluntary: boolean;
      readonly heroFormIndex: number;
    }
  /**
   * `flipToOtherFace` to a new card type, from a "flip this card" (`cardFlipped` after). `reveal`: the flip also reveals
   * the new face (`flipCard.reveal`), and `flipToOtherFace` pushes the `cardFlipped` itself, under the reveal.
   */
  | {
      readonly kind: "flipToOtherFace";
      readonly id: InstanceId;
      readonly playerId: PlayerId;
      readonly reveal?: true;
      /** The player whose effect flipped it (`cardFlipped.playerId`), when it had one. */
      readonly flippedBy?: PlayerId;
    };

/** The `cardFlipped` announcement for a card `by` flipped (`null` or absent: the flip had no "you"). */
export const cardFlippedEvent = (instanceId: InstanceId, by?: PlayerId | null): TriggerEvent => ({
  kind: "cardFlipped",
  instanceId,
  ...(by ? { playerId: by } : {}),
});

/**
 * What a caller of `leavePlay` sets on the card once it has left (`tuckCards`, `takeIntoHand`), with the move and after
 * any "when it leaves play" interrupt (`applyLeavePatch`). `ownerId`: "take it into your hand" of another player's card
 * changes its owner then, not before the card waits (docs/phase7-wave5.md §4.1 Q35).
 */
export interface LeavePatch {
  readonly faceup?: boolean;
  readonly controllerId?: PlayerId | null;
  readonly attachedTo?: null;
  readonly ownerId?: PlayerId;
}

/**
 * The stat a basic power uses when nothing substitutes another (RRG 1.8 "Basic Power", p. 10): the default of the
 * `stat` on `basicPowerUsing` / `basicPowerUsed`.
 */
export const BASIC_POWER_STAT = {
  attack: "atk",
  thwart: "thw",
  defense: "def",
  recover: "rec",
} as const satisfies Record<"attack" | "thwart" | "defense" | "recover", StatName>;

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
    // "When you make a basic recovery … instead of healing damage" (wave 6 §3.40): the healing is still to come.
    case "basicRecovery":
    case "turnEnding":
    // "Interrupt: When you change to hero form" (`formChanging`): the change is still to come.
    case "formChanging":
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
    // "At the start of step three of the villain phase" (docs/phase7-wave6.md §3.61): the step's deal is still to come.
    case "villainStepStarting":
    // "When you spend this card" (an interrupt) and "After you spend this card" (a response) both have a window. The
    // cards are already discarded when it is pushed — every cost is paid at once (RRG 1.8 "Cost", p. 13) — so its
    // apply step changes nothing; see docs/phase7-wave2.md §12.2 for what that does and does not let an interrupt do.
    case "resourcesSpent":
    /**
     * "Forced Interrupt: When an environment enters play, …" (None Shall Pass 1B): the card is already in the play
     * area by the time this is pushed, but nothing it does *on* entering has happened yet — the enter-play keywords
     * (toughness, uses counters, the restricted and ally-limit checks) are this event's own apply step
     * (`resolve/event.ts`), so an interrupt runs before them and a response after, which is also what RRG 1.8
     * "Ally Limit" (p. 7) asks for: the check "occurs before abilities that resolve upon entering play".
     */
    case "cardEntersPlay":
    // "When this stage would be completed" (docs/phase7-wave4.md §3.4): the completion is still to come.
    case "mainSchemeCompleting":
    // The stage's turn to its B side is this event's apply step (docs/phase7-wave8.md §4.1 Q56).
    case "mainSchemeTurnsToB":
    // "When an enemy would activate" (docs/phase7-wave5.md §3.2): the activation is still to come.
    case "enemyActivating":
    // "Interrupt: When attached side scheme is defeated" (Chance Encounter, Followed, Ambush, Twisted Reality;
    // docs/phase7-wave4.md §3.37): the scheme and its attachments are still in play; its When Defeated and its leaving
    // play are this event's apply step (RRG 1.8 "When Defeated Abilities", p. 48: a forced interrupt; the card "leaves
    // play after its 'When Defeated' ability is resolved").
    case "schemeDefeated":
    // "When you would draw or discard an encounter card from your deck" (docs/phase7-wave5.md §3.5): an interrupt. The
    // card is already where the draw or discard put it when this is pushed (after the whole draw, MC27 p. 21 FAQ); the
    // interrupt's own effect moves it on, and the apply step deals it only if nothing did (§4.1 Q4).
    case "encounterCardFromPlayerDeck":
      return false;
    // "When X leaves play" (docs/phase7-wave5.md §3.13, §4.1 Q17): an interrupt window before the move (`leaving`), or a
    // late one after it; only the responses when its interrupts already resolved (the card left during them).
    case "cardLeavesPlay":
      return event.interruptsResolved === true;
    // "When the last lock counter is removed from here" (docs/phase7-wave4.md §3.15): the removal is still to come,
    // unless a cost removed them (`paidAsCost`, §3.85 of wave 6): then they are gone already, and only responses answer.
    case "countersRemoved":
      return event.paidAsCost === true;
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
      return of([event.sourceInstanceId], [event.schemeInstanceId], []);
    case "removeThreat":
      return of([event.sourceInstanceId], [event.schemeInstanceId], [event.playerId ?? null]);
    case "attack":
      // An "(attack)" ability's attack that attacked several enemies attacked each of them (`attack.attacked`).
      return of([event.attackerInstanceId], event.attacked ?? [event.targetInstanceId], [event.playerId]);
    case "thwart":
      // A "(thwart)" ability that removed threat from several schemes thwarted each of them (`thwart.instances`).
      return of(
        [event.thwarterInstanceId],
        event.instances
          ? [...new Set(event.instances.map((instance) => instance.schemeInstanceId))]
          : [event.schemeInstanceId],
        [event.playerId],
      );
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
    // "That treachery" is `eventTarget`; "you" (the player who resolved it) the player subject.
    case "encounterCardResolved":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    // The defeating card is the event's source, so `sourceIs` reads "after [this card] defeats …"; the defeated card
    // stays the target, and the defeating player the player subject.
    case "characterDefeated":
      return of([event.sourceInstanceId ?? null], [event.instanceId], [event.defeatedByPlayerId ?? null]);
    case "schemeDefeated":
      // The defeating player, so "after *you* defeat a side scheme" reads like the `characterDefeated` case above.
      return of([event.sourceInstanceId ?? null], [event.instanceId], [event.defeatedByPlayerId ?? null]);
    case "cardFlipped":
      return of([], [event.instanceId], [event.playerId ?? null]);
    case "discardRedirected":
      return of([], [event.instanceId], []);
    case "mainSchemeCompleted":
    case "mainSchemeCompleting":
    case "mainSchemeTurnsToB":
      return of([], [event.schemeInstanceId], []);
    case "enemyActivating":
      return of([event.enemyInstanceId], [event.enemyInstanceId], [event.playerId]);
    case "accelerationTokenPlaced":
      return of([], [event.instanceId], []);
    case "encounterCardFromPlayerDeck":
      return of([], [event.instanceId], [event.playerId]);
    case "cardEntersHand":
      return of([], [event.instanceId], [event.playerId]);
    // The discarded card is the target ("this card", "that card"); the deck's player is "you"; the discarding card the
    // source.
    case "cardDiscardedFromDeck":
      return of([event.sourceInstanceId], [event.instanceId], [event.playerId]);
    case "cardLeavesPlay":
      return of([], [event.instanceId], [event.controllerId ?? event.speakerId ?? null]);
    case "boostCardResolved":
      return of([event.enemyInstanceId], [event.boostInstanceId], [event.playerId]);
    case "boostIconsCounting":
      return of([event.enemyInstanceId], [event.cardInstanceId], [event.playerId]);
    case "basicPowerUsed":
    case "basicPowerUsing":
    case "basicRecovery":
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
    // The placer is "you" ("After you place a magnet counter"); the card they went on is the target ("here").
    case "countersPlaced":
      return of([], [event.targetInstanceId], [event.playerId]);
    case "villainSwapped":
      return of([], [event.villainInstanceId], []);
    // The card the status card was discarded from is the target ("from Colossus").
    case "statusDiscarded":
      return of([], [event.instanceId], []);
    // The character it was placed on is the target ("on Mister Sinister"); the placing card and player are the source
    // and "you".
    case "statusPlaced":
      return of([event.sourceInstanceId], [event.instanceId], [event.playerId]);
    // The attached card is the source ("a Frostbite upgrade"), its host the target ("to an enemy"), the attacher "you".
    case "cardAttached":
      return of([event.instanceId], [event.hostInstanceId], [event.playerId]);
    // The character whose hit points were reset is the target ("After MaGog's hit points are reset").
    case "hitPointsReset":
      return of([], [event.instanceId], []);
    // "You" ignored it; "that minion" / "that scheme" is the target.
    case "keywordIgnored":
      return of([event.characterInstanceId], [event.cardInstanceId], [event.playerId]);
    case "deckRanOut":
      return of([], [], [event.playerId ?? null]);
    // An additional form's card, or the identity for the hero/alter-ego flip.
    case "formChanged":
      return of([], [event.formCardInstanceId ?? event.identityInstanceId ?? null], [event.playerId]);
    case "formChanging":
      return of([], [event.identityInstanceId], [event.playerId]);
    case "turnStarted":
    case "turnEnding":
      return of([], [], [event.playerId]);
    case "minionEngaged":
      return of([event.minionInstanceId], [event.minionInstanceId], [event.playerId]);
    case "surgeResolving":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    case "abilityResolved":
      return of([event.instanceId], [], [event.controllerId]);
    // The raising card is the source ("Bishop's 'Energy Absorption'"); the player who resolved it is "you".
    case "momentRaised":
      return of([event.sourceInstanceId], [], [event.playerId]);
    case "resourcesSpent":
      // `forPlayerId` first, so `eventPlayer` is "that player" (Everyday Hero); the spender is "you" either way.
      return of(
        event.cardInstanceIds,
        [event.purpose === "playCard" ? event.payingForInstanceId : null],
        event.forPlayerId === event.playerId ? [event.playerId] : [event.forPlayerId, event.playerId],
      );
    case "resourcesGenerated":
      // The generating player first: "that player" (`eventPlayer`) is who generated them.
      return of(
        [],
        [event.purpose === "playCard" ? event.payingForInstanceId : null],
        event.forPlayerId === event.playerId ? [event.playerId] : [event.playerId, event.forPlayerId],
      );
    default:
      return of([], [], []);
  }
}

/** The prefix an ability answering a moment reads its carried slots and vars under (`EffectSpec raiseMoment.carry`). */
export const MOMENT_PREFIX = "moment.";

const NOTHING_CARRIED: {
  readonly bindings: Readonly<Record<string, readonly InstanceId[]>>;
  readonly vars: Readonly<Record<string, number>>;
} = { bindings: {}, vars: {} };

/**
 * What the event an ability answers hands to that ability's slots and vars (docs/phase7-wave8.md §3.71): the slots and
 * vars a `momentRaised` carries, each under `MOMENT_PREFIX`, so the raising ability's `pulled` is the answering
 * ability's `moment.pulled` and `pulled.count` its `moment.pulled.count`. The prefix keeps them apart from the
 * answering ability's own slots and cost results. Every other event, and a moment that carries nothing, gives nothing.
 *
 * Read wherever an ability is judged or resolved against its event: its condition and targets (`resolve/triggers.ts`,
 * `target-validity.ts`), its cost (`actions.ts`) and its frame (`abilityFrame`).
 */
export function carriedByEvent(event: TriggerEvent | null | undefined): typeof NOTHING_CARRIED {
  if (event?.kind !== "momentRaised" || (!event.carried && !event.carriedVars)) return NOTHING_CARRIED;
  const prefixed = <T>(record: Readonly<Record<string, T>> | undefined): Record<string, T> =>
    Object.fromEntries(Object.entries(record ?? {}).map(([key, item]) => [`${MOMENT_PREFIX}${key}`, item]));
  return { bindings: prefixed(event.carried), vars: prefixed(event.carriedVars) };
}
