import type { AbilityId, KeywordInstance, Trait } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import type { ResourcePool, ResourceRequirement, TypedResource } from "./resources.js";
import type { AttackKeyword, EffectSpec, PlayerRef, Predicate, SchemeValueName, StatName, TargetQuery, TargetRef, ValueSpec } from "./spec.js";
import type { Form } from "./state.js";
import type { TriggerEventKind } from "./trigger-events.js";

/**
 * How an ability's card must relate to an event for the ability to trigger.
 * `selfIs` covers "when *this card* is attacked / deals damage / …" and
 * `playerIs` covers "…attacks *you*".
 */
export interface EventPattern {
  /** One event kind, or several: "After Madame Hydra schemes or attacks" → `["enemyScheme", "enemyAttack"]`. */
  readonly on: TriggerEventKind | readonly TriggerEventKind[];
  readonly selfIs?: "source" | "target" | "either";
  readonly playerIs?: "controller";
  /** The originally-attacked player rather than the final target (RRG p.9). */
  readonly usesAttackedPlayer?: boolean;
  readonly targetIs?: TargetQuery;
  /** The event's source must match: "When Rhino attacks" → `{ categories: ["villain"] }`; "When attached enemy attacks" → `{ hostOfSelf: true }`. */
  readonly sourceIs?: TargetQuery;
  readonly fromAttack?: boolean;
  /**
   * Results the event must have produced, read at response time: "after X
   * attacks and damages" → `{ damage: 1 }`, "…and defeats" → `{ defeated: 1 }`,
   * "…undefended" → `{ undefended: 1 }`. Keys are the event's `results`.
   */
  readonly requireResults?: Readonly<Record<string, number>>;
  /**
   * The upper-bound counterpart of `requireResults`: each result must be **at most** this, read at the same moment.
   * `{ damage: 0 }` is "and take no damage" / "if it dealt no damage" — a bound `requireResults` and `eventAtLeast`,
   * both minimums, cannot express. A missing result reads as 0 and therefore satisfies any non-negative bound.
   *
   * It is part of the *trigger condition*, so an ability whose bound fails is never offered and its cost is never
   * paid — which is what "Response: After you defend against an attack **and take no damage**, exhaust this →" needs
   * (FAQ "Unflappable (#20)", RRG 1.8 p. 60: "The cost of the ability on Unflappable only requires that the
   * defending identity take no damage during step 4 of the enemy attack"). Modeling the same sentence as an
   * effect-level `if` would charge the cost first, which is a different card.
   */
  readonly resultsAtMost?: Readonly<Record<string, number>>;
  /** "After you make a basic attack" → `basic`; "(attack)" abilities → `ability`. */
  readonly attackKind?: "basic" | "ability";
  /** The activation the event belongs to: "while the villain attacks" / "during a scheme activation" (boost card events). */
  readonly activation?: "attack" | "scheme";
  /**
   * Numbers the event itself carries must be at least this, in both windows: `{ boostIcons: 1 }` for "cancel the boost
   * icons on that card", which cannot trigger on a card with none (FAQ "Attacrobatics (#6)", p. 59).
   */
  readonly eventAtLeast?: Readonly<Record<string, number>>;
  /**
   * String fields the event itself carries must equal these, in both windows — the string counterpart of
   * `eventAtLeast`. `{ to: "hero" }` is "After a player changes to **hero form**" (Taskmaster 04093–04095), which
   * `formChanged`'s own `to` field already records but no pattern field could read. An event without the field, or
   * with a different value, never matches.
   *
   * Pair it with *no* `playerIs`, and the pattern is "after **a player** …" rather than "after **you** …"; the
   * effect body then names them with `PlayerRef { kind: "eventPlayer" }`.
   */
  readonly eventIs?: Readonly<Record<string, string>>;
}

/**
 * RRG "Labeled Ability": "(attack)" / "(thwart)" / "(defense)". The player's
 * identity performs the labeled action once the ability begins resolving; a
 * stunned (attack) or confused (thwart) identity cancels the whole ability
 * except its costs. A defense label makes the identity the defender of the
 * current enemy attack if it has none (no DEF reduction, no exhaust).
 */
export type AbilityLabel = "attack" | "thwart" | "defense";

export type AbilityTriggerSpec =
  | { readonly kind: "action"; readonly form?: Form }
  /** "Resource:" / "Hero Resource:" — triggered while paying a cost. */
  | { readonly kind: "resource"; readonly form?: Form }
  /** `form` is the "Hero Interrupt" / "Alter-Ego Response" gate on the controller. */
  | { readonly kind: "interrupt"; readonly forced: boolean; readonly on: EventPattern; readonly form?: Form }
  | { readonly kind: "response"; readonly forced: boolean; readonly on: EventPattern; readonly form?: Form }
  | { readonly kind: "whenRevealed" }
  | { readonly kind: "whenDefeated" }
  /**
   * RRG 1.8 "When Completed Abilities" (p. 48): "equivalent to … 'Forced Interrupt: When this scheme is completed…'".
   * Resolves on a main scheme stage reaching its target threat, before it advances; never on the final stage, whose
   * completion loses the game.
   */
  | { readonly kind: "whenCompleted" }
  | { readonly kind: "boost" }
  | { readonly kind: "setup" }
  /** RRG "Special": resolves only when another ability instructs it (`resolveSpecials`; Wakanda Forever!). */
  | { readonly kind: "special" }
  /**
   * A forced ability that resolves when a condition becomes true, with no triggering event: "If there are no madness
   * counters here, flip Green Goblin and State of Madness." Checked between every two frames (as the RRG 1.8 "Uses"
   * discard is, p. 46), so it happens immediately, mid-attack included (FAQ "Green Goblin (#1B)", p. 59).
   *
   * Edge-triggered: it fires when the condition changes from false to true, and not again until it has been false.
   * A card's first observation only records the value. So a card that enters play, or flips to a face, with the
   * condition already true does not fire until the condition has been false once. That keeps "enters play with N
   * counters" scripted as a response from racing the check. It is the engine's reading, not a printed rule: see
   * docs/phase7-wave1.md §4.1.
   */
  | { readonly kind: "stateCheck"; readonly when: Predicate }
  | {
      readonly kind: "constant";
      readonly modifiers?: readonly StatModifierSpec[];
      /** "X gains retaliate 1" — keywords the matching cards gain while this card is in play. */
      readonly keywordGrants?: readonly KeywordGrantSpec[];
      /** "Captain Marvel gains the Aerial trait". */
      readonly traitGrants?: readonly TraitGrantSpec[];
      /** Rule restrictions: "cannot take damage", "threat cannot be removed", ally limit, "must defend with an ally". */
      readonly rules?: readonly RuleSpec[];
      /**
       * "Double the resources this card generates while paying for an
       * [aspect] card" (The Power of X): multiplies this card's printed
       * resources when it is discarded to pay for a card matching the query.
       */
      readonly resourceMultiplier?: { readonly factor: number; readonly whilePayingFor: TargetQuery };
      /** Changes to the cost of playing cards (docs/phase7-wave1.md §3.10). */
      readonly costModifiers?: readonly CostModifierSpec[];
      /** "You can only spend [physical] resources to pay for this card." (Crushing Blow). Read from the card being paid for. */
      readonly paymentOnly?: readonly TypedResource[];
      /** "Spend this card only in hero form." (Limitless Strength). Read from a hand card when it is spent. */
      readonly spendableIn?: Form;
      /**
       * "You may play Lockjaw from your discard pile during your turn." A permission read from the card itself (RRG 1.8
       * "Play Restrictions and Permissions", p. 33: "a permission might allow an ally card to be played from a player's
       * discard pile").
       */
      readonly playableFrom?: readonly "discard"[];
      /**
       * "You may play [Arrow] events attached to this card as if they were in your hand" (Hawkeye's Quiver; docs/phase7-
       * wave2.md §3.10): cards attached to this card that match may be played by its controller as if from hand. A
       * permission on the host, where `playableFrom` is one on the card itself.
       */
      readonly playableAttachments?: TargetQuery;
      /** "As an additional cost for Wonder Man to attack, you must discard 1 card." Costs on this character's own basic powers. */
      readonly basicPowerCosts?: readonly { readonly power: "attack" | "thwart"; readonly cost: AbilityCost }[];
    };

/**
 * A change to what a card costs to play. `delta` is signed: −1 "reduce the cost by 1", +3 "costs 3 additional
 * resources" (Physical Toll). `appliesTo` is the card being played, `host` the card it will be attached to ("each upgrade
 * on Iron Man"), `while` gates it ("the first ally played each round" with `playedThisRound`).
 *
 * In play by default. `activeIn: "hand"` is read from the card being played while it is in hand ("Reduce the cost to
 * play Hercules by 1 for each minion engaged with you"); RRG 1.8 "In Play and Out of Play" (p. 23): out-of-play text
 * works only when it "specifically refer[s] to being used from an out-of-play area".
 */
export interface CostModifierSpec {
  readonly delta: number | ValueSpec;
  readonly appliesTo: TargetQuery;
  readonly host?: TargetQuery;
  readonly while?: Predicate;
  readonly activeIn?: "hand";
}

/** A constant ability's stat change. `while` gates it (RRG "Constant Abilities"). */
export interface StatModifierSpec {
  /**
   * A character or hand-size stat, a scheme threat value (`SchemeValueName`), `boostIcons` ("This card gets +1 boost
   * icon if …", read from the boost card itself while it resolves, `boostIconsFor`), or an ally's consequential
   * damage ("takes +1 consequential damage after it attacks", Enraged).
   */
  readonly stat: StatName | "hp" | "handSize" | SchemeValueName | "boostIcons" | "consequentialAttack" | "consequentialThwart";
  /**
   * A number, or a value read from game state on every check: "+1 THW for each
   * side scheme in play" (`count`), "X is equal to Titania's remaining hit
   * points" (`remainingHp`), "+1 hand size per Tech upgrade (max 7)" (`scaled`),
   * "+1 DEF (+2 instead if you have the Aerial trait)" (`conditional`).
   */
  readonly amount: number | ValueSpec;
  readonly target: TargetQuery;
  readonly while?: Predicate;
  /**
   * Replace the base value instead of adding: "Each facedown Drone minion has a
   * base SCH of 1, a base ATK of 1, and a base hit points of 1" (Ultron Drones).
   * Additive modifiers still apply on top.
   */
  readonly setBase?: boolean;
}

/** "X gains [keyword]" while the granting card is in play. */
export interface KeywordGrantSpec {
  readonly keyword: KeywordInstance;
  readonly target: TargetQuery;
  readonly while?: Predicate;
}

/** "X gains the [trait] trait" while the granting card is in play. */
export interface TraitGrantSpec {
  /** The trait granted. Absent when `traitsOf` names where the traits come from instead. */
  readonly trait?: Trait;
  /**
   * "Absorbing Man gains the trait of each environment in play" (docs/phase7-wave2.md §3.11): the printed traits of every
   * card in play this query matches (from the granting card's point of view) are granted. Printed traits only, so grants
   * can't feed each other.
   */
  readonly traitsOf?: TargetQuery;
  readonly target: TargetQuery;
  readonly while?: Predicate;
}

/** Rule restrictions a constant ability imposes (RRG "Cannot" wins over "can"). */
export type RuleSpec =
  /** "X cannot take damage [while …]" (Ultron III, Madame Hydra); `fromSource`: "…from Black Panther upgrades" (Killmonger). */
  | { readonly kind: "cannotTakeDamage"; readonly target: TargetQuery; readonly while?: Predicate; readonly fromSource?: TargetQuery }
  /** "Threat cannot be removed from this scheme" (Countdown to Oblivion); `by: "thwart"`: "… from attached scheme by thwarting" (Held Hostage). */
  | { readonly kind: "threatCannotBeRemoved"; readonly target: TargetQuery; readonly while?: Predicate; readonly by?: "thwart" }
  /** "While Baron Zemo is engaged with you, you cannot thwart." `player` is resolved with "you" as the rule card's speaker (`speakerOf`). */
  | { readonly kind: "cannotThwart"; readonly player: PlayerRef; readonly while?: Predicate }
  /** "… cannot ready" (All Tied Up). */
  | { readonly kind: "cannotReady"; readonly target: TargetQuery; readonly while?: Predicate }
  /** "You cannot change form" (All Tied Up). */
  | { readonly kind: "cannotChangeForm"; readonly player: PlayerRef; readonly while?: Predicate }
  /** "Players cannot attack other villains." (Distracting Taunts): player attacks against a matching card are illegal. */
  | { readonly kind: "cannotAttack"; readonly target: TargetQuery; readonly while?: Predicate }
  /** "Resolve each 'When Revealed' ability that you reveal 1 additional time." (Media Coverage). */
  | { readonly kind: "repeatWhenRevealed"; readonly player: PlayerRef; readonly times: number; readonly while?: Predicate }
  /**
   * "Increase your ally limit by N" — for the controller of the card (The Triskelion), optionally conditional
   * ("If each of your allies has the Avenger trait, increase your ally limit by 1" — Avengers Tower, `cap` pack).
   */
  | { readonly kind: "allyLimit"; readonly amount: number; readonly while?: Predicate }
  /**
   * "Stinger does not count against your ally limit." (docs/phase7-wave2.md §3.5): matching allies are left out of the
   * count. RRG 1.8 "Ally Limit" (p. 7): the check "occurs before abilities that resolve upon entering play", so this is a
   * constant read at the check, not an ability that resolves.
   */
  | { readonly kind: "excludedFromAllyLimit"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Threat you remove using your basic thwart power (THW) can be divided among schemes as you choose." / "Damage you
   * deal using your basic attack power (ATK) can be divided among enemies as you choose." (Wasp's Giant form). Matching
   * characters may use `basicAttack.divide` / `basicThwart.divide`. FAQ "Wasp (#1C)" (RRG 1.8 p. 61): the targets are
   * chosen and checked (guard, patrol, crisis) when the power is used, each target is attacked, and each retaliate
   * damages her in the order of her choice. docs/phase7-wave2.md §3.7.
   */
  | { readonly kind: "divideBasicPower"; readonly power: "attack" | "thwart"; readonly target: TargetQuery; readonly while?: Predicate }
  /** "When a character thwarts this side scheme, they may use their ATK instead of their THW" (The Red House): `basicThwart.useAtk`. */
  | { readonly kind: "thwartWithAtk"; readonly scheme: TargetQuery; readonly while?: Predicate }
  /**
   * "Each of your [Arrow] attacks gain ranged" (Hawkeye's Bow): an `AttackKeyword` granted to *attacks*, not to a
   * character. RRG 1.8 defines piercing, ranged and overkill as properties of an attack ("An attack with the …
   * keyword"), so a grant can be keyed on either end of one:
   * - `attacker` matches the attacking character ("attacks made by your allies gain overkill");
   * - `via` matches the card whose ability is making the attack — the event for a "Hero Action (attack)", the
   *   upgrade or ally for an ability on one. A basic attack has no such card and never matches a rule with `via`.
   *
   * Both are optional and ANDed. A rule with neither grants the keyword to every attack in the game, which no card
   * does; `@mc/cards` should always set at least one.
   */
  | {
      readonly kind: "attackKeywords";
      readonly keywords: readonly AttackKeyword[];
      readonly attacker?: TargetQuery;
      readonly via?: TargetQuery;
      readonly while?: Predicate;
    }
  /**
   * "You cannot play hero-specific cards." (Depowered): `player` cannot play cards matching `cards`. FAQ "Depowered
   * (#20)" (RRG 1.8 p. 60): Invocation cards "are merely resolved, not played", so a resolve is not blocked.
   */
  | { readonly kind: "cannotPlay"; readonly player: PlayerRef; readonly cards: TargetQuery; readonly while?: Predicate }
  /**
   * "Players cannot trigger 'Alter-Ego Action' abilities on obligations." (Corrupted Timestream): an action ability of a
   * card matching `on`, with that form label (absent: any), cannot be triggered.
   */
  | { readonly kind: "cannotTriggerActions"; readonly on: TargetQuery; readonly form?: Form; readonly while?: Predicate }
  /**
   * "When this scheme is defeated, shuffle it into the encounter deck instead of discarding it." (Time Portal): a matching
   * side scheme that is defeated goes into the encounter deck, which is shuffled, instead of the discard pile.
   */
  | { readonly kind: "defeatedIntoEncounterDeck"; readonly target: TargetQuery; readonly while?: Predicate }
  /** "The engaged player must defend against [attacker]'s attacks with an ally they control, if able" (Melter). */
  | { readonly kind: "mustDefendWithAlly"; readonly attacker: TargetQuery; readonly while?: Predicate }
  /**
   * "When Wrecker schemes, place the threat on his side scheme instead of the main scheme" — printed as a constant ★
   * ability on each Wrecking Crew villain (docs/phase7-wave1.md §3.6). A scheme activation by a matching enemy places
   * its threat on that villain's signature side scheme while it is in play, else on the main scheme.
   */
  | { readonly kind: "schemeThreatDestination"; readonly enemy: TargetQuery; readonly scheme: "ownSignatureSideScheme"; readonly while?: Predicate }
  /**
   * "Excess damage dealt by Thunderball is placed as threat on his corresponding side scheme" (Radioactive Buildup,
   * 07022). Whenever a card matching `source` deals damage beyond the target's remaining hit points, that much threat
   * is placed on `scheme`: `"ownSignatureSideScheme"` is the dealing villain's signature side scheme (nothing if it
   * is not in play), a `TargetRef` is read from the rule card ("his" on an attachment is
   * `signatureSideSchemeOf { villain: host }`).
   *
   * Any damage the source deals, not just its attacks: the card says "excess damage dealt by", not "by his attacks".
   * Excess damage is measured as RRG 1.8 "Excess Damage" (p. 19) defines it, damage *dealt* beyond remaining hit
   * points, so it is placed even when a tough status card or "cannot take damage" stops the target taking it (ruling,
   * Jan 26, 2026 (3)). See `resolve/event.ts` `applyDamage` for the ordering and the open overkill question.
   */
  | { readonly kind: "excessDamageAsThreat"; readonly source: TargetQuery; readonly scheme: "ownSignatureSideScheme" | TargetRef; readonly while?: Predicate }
  /** "This card cannot leave play while [villain] is in play." RRG 1.8 "'Cannot'" (p. 11): absolute, like the permanent keyword. */
  | { readonly kind: "cannotLeavePlay"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * The Wrecking Crew insert, "Signature Side Schemes": "These side schemes are not discarded when they have no threat on
   * them." A scenario rule overriding RRG 1.8 "Defeat" (p. 15) under the Golden Rules (p. 4), carried by the main scheme.
   */
  | { readonly kind: "notDefeatedWithoutThreat"; readonly target: TargetQuery; readonly while?: Predicate };

/** Where a cost may pick a card from (outside play). */
export interface CardZoneQuery {
  /** `separateDeck`: an identity's separate deck, named by `separateDeck` ("the top card of the Invocation deck"). */
  readonly zone: "discard" | "hand" | "deck" | "separateDeck";
  /** Whose zone: the paying player's, or any player's. */
  readonly player: "you" | "any";
  readonly query?: TargetQuery;
  /** Which separate deck, with zone `separateDeck`. */
  readonly separateDeck?: string;
  /** Only the top N cards of the zone. */
  readonly top?: number;
}

/**
 * What an ability costs to initiate (RRG "Cost"). Every component is paid at
 * once when the ability is initiated; if any component can't be paid in full,
 * the ability can't be initiated. Cards the player picks as part of a cost are
 * named up front in the command's `costChoices` (keyed by the slot named here)
 * and are bound into the ability's effects under the same slot.
 */
export interface AbilityCost {
  /** "Exhaust [this card] →". */
  readonly exhaustSelf?: boolean;
  /** "Spend a [energy] resource" → `{ energy: 1 }`; "Spend [E][M][P]" → one of each. A number is a generic amount. */
  readonly resources?: number | ResourceRequirement;
  /**
   * "Spend X [energy] resources →": X is every resource in the payment usable
   * as that type (beyond any fixed `resources`), bound to var `bind`.
   */
  readonly resourcesX?: { readonly resource: TypedResource; readonly bind: string; readonly min?: number };
  /** "Remove 1 web counter from it →". */
  readonly spendCounters?: { readonly counterType: string; readonly amount: number };
  /** "Take 1 damage →" (Focused Rage): the controller's identity takes the damage. */
  readonly damageSelf?: number;
  /** "Deal 2 damage to him →" (War Machine): this card takes the damage. */
  readonly damageThisCard?: number;
  /** "Heal 1 damage from Captain Marvel →": the controller's identity must have that much damage to heal. */
  readonly healIdentity?: number;
  /**
   * "Discard [this card] →" (Cosmic Flight, Tenacity, Energy Channel). The
   * card's counters are snapshotted into vars `self.counters.<type>` first, so
   * "for each counter here" still reads them after the discard. Its threat and
   * damage are snapshotted the same way, into `self.threat` and `self.damage`:
   * "Exhaust and discard Beat Cop → deal 1 damage to a minion for each threat
   * here" (leaving play clears both).
   */
  readonly discardSelf?: boolean;
  /**
   * "Discard 1 card at random from your hand →" (Magic Crowbar, Ball and Chain, Bulldozer's Helmet): this many cards,
   * picked with the game's seeded RNG as the cost is paid, so a replay picks the same cards. Payable only with at least
   * that many cards in hand beyond this card and the cards the payment spends (RRG 1.8 "Cost", p. 13: a cost is paid in
   * full). A hand of exactly that many is discarded whole (ruling, Feb 28, 2026 (4) answer 1). The picked cards aren't
   * bound: they are only known once the cost is paid.
   */
  readonly discardRandomFromHand?: number;
  /** "Exhaust your hero →" / "Exhaust your identity →" (encounter-card Hero Actions). */
  readonly exhaustIdentity?: boolean;
  /**
   * "Choose and discard 1 card from your hand →" (min 1, max 1) / "Choose and
   * discard up to 5 cards" (min 0, max 5) / "Discard X cards from your hand →" with no printed cap (Shield Toss:
   * `max` omitted — bounded only by hand size, since a player can never select a card twice or one not in hand).
   * Picked in `costChoices.discard`; the cards are bound to slot `discard` and their count to var `bind`.
   */
  readonly discardFromHand?: { readonly min: number; readonly max?: number; readonly bind?: string };
  /**
   * "Pay the printed cost of an ally in any player's discard pile →" (Make the
   * Call): the card picked in `costChoices[slot]` adds its printed cost to the
   * resource requirement and is bound to `slot`.
   *
   * `entersPlay` declares that the ability's effects then bring the picked card
   * into play. The engine uses it to refuse a pick that could not enter play —
   * RRG 1.8 "Unique Icon" (a card matching one in play), checked at initiation so
   * the cost is never paid for nothing (RRG "Target": an ability "can only be
   * initiated if it has at least one valid target").
   */
  readonly payPrintedCostOf?: { readonly slot: string; readonly from: CardZoneQuery; readonly entersPlay?: boolean };
  /** "Spend 2 resources of different types" (Red Dagger): the payment must hold this many types; a wild can be any one. */
  readonly distinctResourceTypes?: number;
  /**
   * "Exhaust Captain America's Shield →" (min 1, max 1) / "Exhaust any number of allies you control →" (min 1, no
   * max): exhaust cards in play, other than this ability's own card (`exhaustSelf`) or your identity
   * (`exhaustIdentity`). See `InPlayCostPick` for how the cards are picked and when the cost is payable.
   */
  readonly exhaustCards?: InPlayCostPick;
  /** "… return Captain America's Shield from play to your hand →": cards in play go to their owner's hand. See `InPlayCostPick`. */
  readonly returnToHand?: InPlayCostPick;
}

/**
 * A cost paid with cards in play (`AbilityCost.exhaustCards` / `returnToHand`).
 *
 * - **Who pays.** Only cards in play that the paying player controls and that match `query` are candidates (RRG 1.8
 *   "Cost", p. 14: "that player must pay costs with cards and/or game elements they control"; ruling June 25, 2026
 *   #1: Steve Rogers can't pay Shield Toss with a Shield Falcon controls). An exhaust candidate must be ready. A
 *   return candidate must be able to leave play (RRG "Cannot", p. 11).
 * - **How many.** `min`–`max` cards; `max` omitted means no cap. "Any number" and "up to N" still mean at least one
 *   (RRG 1.8 "Cost", p. 14), so `min` is at least 1 (`@mc/cards`' validator enforces it).
 * - **Picking.** The picks come from `costChoices[slot]`. With no picks given, the cost pays itself only when the
 *   choice is forced: exactly `min` candidates exist, so every legal payment takes all of them (a unique Shield).
 *   Otherwise the command must name its picks. The cards are bound to `slot`, their count to var `bind`.
 * - **Payable.** With fewer than `min` candidates the cost can't be paid, so the ability can't be initiated and
 *   `legalActions` doesn't offer it (RRG 1.8 "Initiating Abilities", p. 24, steps 3 and 5).
 * - **All at once.** A card can pay only one component of a cost: it can't be exhausted twice, both exhausted and
 *   returned, or also exhausted for a resource in the same payment (RRG 1.8 "Cost", p. 13: multiple costs "must be
 *   paid simultaneously").
 */
export interface InPlayCostPick {
  readonly slot: string;
  readonly query: TargetQuery;
  readonly min: number;
  readonly max?: number;
  readonly bind?: string;
}

export interface AbilityLimit {
  readonly count: number;
  readonly period: "turn" | "phase" | "round";
  /**
   * "(Limit once per round **for each aspect**.)" (Superhuman Agility, 04031a): the count is kept separately for
   * each value of this key, so the ability may resolve `count` times per period *per* value.
   *
   * - `"aspectOfEventCard"`: the aspect of the card the triggering event names — its `printedAspect` if it has one
   *   (an identity-specific card that prints an aspect, §1.2), else its `aspect`.
   *
   * Only meaningful on a triggered ability: with no triggering event (an "Action" used by command) the ability falls
   * back to one shared count, exactly as an unqualified limit behaves today.
   */
  readonly per?: "aspectOfEventCard";
}

/**
 * What a resource ability generates. A bare number is that many wild
 * resources; a pool is typed ("Generate a [mental] resource" → `{ mental: 1 }`);
 * `topCardOfDiscard` copies the printed resources of the top card of the
 * controller's discard pile (Pepper Potts).
 */
export type ResourceGeneration =
  | number
  | Partial<ResourcePool>
  | { readonly kind: "topCardOfDiscard" };

export interface AbilityDefinition {
  readonly trigger: AbilityTriggerSpec;
  readonly cost?: AbilityCost;
  readonly limit?: AbilityLimit;
  readonly label?: readonly AbilityLabel[];
  readonly effects: readonly EffectSpec[];
  /** Resource abilities only. Defaults to 1 wild resource. */
  readonly generates?: ResourceGeneration;
  /** Resource abilities only: "generate a [wild] resource for an event" — usable only while paying for a matching card. */
  readonly generatesFor?: TargetQuery;
}

/** Ability definitions are engine-side data keyed by the `AbilityId` printed on cards. */
export type AbilityRegistry = Readonly<Record<string, AbilityDefinition>>;

export const NO_ABILITIES: AbilityRegistry = {};

export interface EngineDeps {
  readonly abilities: AbilityRegistry;
}

export const DEFAULT_DEPS: EngineDeps = { abilities: NO_ABILITIES };

/** One ability on one card, as found by the trigger matcher. */
export interface AbilitySource {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  readonly controllerId: PlayerId | null;
  readonly definition: AbilityDefinition;
}

export const abilityUseKey = (instanceId: InstanceId, abilityId: AbilityId): string =>
  `${instanceId}:${abilityId}`;
