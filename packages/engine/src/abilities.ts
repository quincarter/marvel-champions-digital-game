import type { AbilityId, KeywordInstance, Trait } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import type { ResourcePool, ResourceRequirement, TypedResource } from "./resources.js";
import type {
  AttackKeyword,
  CardDestination,
  EffectSpec,
  PlayerRef,
  Predicate,
  SchemeValueName,
  StatName,
  TargetQuery,
  TargetRef,
  ValueSpec,
} from "./spec.js";
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
  /**
   * `while`: a condition printed before the cost ("Hero Action: If you are in Tiny hero form, exhaust Army of Ants →
   * deal 1 damage to an enemy."). While it is false the action cannot be triggered, so no cost is paid for nothing.
   */
  /**
   * `firstPlayerOnly`: "First Player Action" (The Galaxy's Most Wanted's side schemes and main schemes: "First Player
   * Action: Exhaust the Milano → remove 3 threat from this scheme"). Only the first player may trigger it, on their turn
   * like any action (RRG 1.8 "Action", p. 6). docs/phase7-wave3.md §3.13.
   */
  | { readonly kind: "action"; readonly form?: Form; readonly while?: Predicate; readonly firstPlayerOnly?: boolean }
  /**
   * "Resource:" / "Hero Resource:" — triggered while paying a cost. `forAnyPlayer`: "Piloting — Resource: Exhaust the
   * Milano → generate a [wild] resource for any player." Any player paying a cost may use it, not only its controller
   * (docs/phase7-wave3.md §3.13).
   */
  | { readonly kind: "resource"; readonly form?: Form; readonly forAnyPlayer?: boolean }
  /**
   * `form` is the "Hero Interrupt" / "Alter-Ego Response" gate on the controller. `firstPlayerOnly`: "First Player
   * Interrupt" (Kree Command Ship, `gmw` 16108) — only the first player is offered it, and they are the one who resolves
   * it (docs/phase7-wave3.md §3.13).
   */
  | {
      readonly kind: "interrupt";
      readonly forced: boolean;
      readonly on: EventPattern;
      readonly form?: Form;
      readonly firstPlayerOnly?: boolean;
    }
  | {
      readonly kind: "response";
      readonly forced: boolean;
      readonly on: EventPattern;
      readonly form?: Form;
      readonly firstPlayerOnly?: boolean;
    }
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
       * "Play only if you control an Element Gun." (Sliding Shot, `stld` 17005): a play restriction whose condition is
       * any `Predicate`, read from the card itself while it is being played (RRG 1.8 "Initiating Abilities", p. 24,
       * step 2: "Check play restrictions"; "Play Restrictions and Permissions", p. 33: "all of its play restrictions
       * must be observed"). The card is not in play when this is checked, which is why it cannot be a `cannotPlay` rule:
       * those are read only from cards in play. `you` is the player playing the card and `self` the card. Enforced
       * wherever `playRestrictionFault` is: a play command, `legalActions`, a play from an effect, and an event offered
       * in a timing window. docs/phase7-wave3.md §3.42.
       *
       * The general form of the printed `PlayRestrictions` fields (`requiresIdentityTrait`,
       * `requiresControlledCharacterTrait`), for the conditions card data cannot say: a named card, a trait on any card
       * type, "any player controls", "at least 3 characters with the [Posse] trait".
       */
      readonly playOnlyIf?: Predicate;
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
  readonly stat:
    | StatName
    | "hp"
    | "handSize"
    | SchemeValueName
    | "boostIcons"
    | "consequentialAttack"
    | "consequentialThwart";
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
  | {
      readonly kind: "cannotTakeDamage";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly fromSource?: TargetQuery;
    }
  /**
   * "Threat cannot be removed from this scheme" (Countdown to Oblivion); `by: "thwart"`: "… from attached scheme by
   * thwarting" (Held Hostage). `player`, resolved with "you" as the rule card's speaker exactly as `cannotAttack`'s own
   * field docs (docs/phase7-wave2.md §25), scopes *who* is blocked rather than restricting every player: absent, it
   * blocks any removal, as every rule before this field existed did; given, only a removal whose player (the thwart's
   * player, else the removing card's controller; a removal with neither is never scoped out) is one of `player`'s
   * players is blocked. "Players other than Gamora cannot remove threat from Sibling Rivalry" (`gam` 18025,
   * docs/phase7-wave3.md §3.26) is `{ player: others(ownerOf(gamorasIdentity)) }`.
   */
  | {
      readonly kind: "threatCannotBeRemoved";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly by?: "thwart";
      readonly player?: PlayerRef;
    }
  /** "While Baron Zemo is engaged with you, you cannot thwart." `player` is resolved with "you" as the rule card's speaker (`speakerOf`). */
  | { readonly kind: "cannotThwart"; readonly player: PlayerRef; readonly while?: Predicate }
  /** "… cannot ready" (All Tied Up). */
  | { readonly kind: "cannotReady"; readonly target: TargetQuery; readonly while?: Predicate }
  /** "You cannot change form" (All Tied Up). */
  | { readonly kind: "cannotChangeForm"; readonly player: PlayerRef; readonly while?: Predicate }
  /**
   * "Players cannot attack other villains." (Distracting Taunts): player attacks against a matching `target` are
   * illegal. `player` scopes the restriction to one player — "You cannot attack Kang" (Fear of Kang, `toafk` 11049).
   * Absent, it binds the whole table, which is what Distracting Taunts' plural printed wording means; every caller
   * that predates the field keeps that meaning. Resolved with "you" as the rule card's speaker (`speakerOf`), so an
   * obligation's "you" is the player whose play area holds it (RRG 1.8 "Obligation", p. 30: "Abilities on
   * obligations that use the words 'you' or 'your' apply only to the player whose play area the obligation is in").
   *
   * **The attacking player is the attacker's controller**, not whoever's turn it is: RRG 1.8 "Guard" (p. 21) states
   * that "that player cannot use cards they control to attack a villain" is *equivalent to* the constant ability
   * "The engaged player cannot attack any villain", so an attack by a player's ally is that player's attack. An
   * attack by an enemy has no controller and is never restricted by this rule. docs/phase7-wave2.md §25.
   */
  | {
      readonly kind: "cannotAttack";
      readonly target: TargetQuery;
      readonly player?: PlayerRef;
      readonly while?: Predicate;
      /**
       * "Drax cannot attack minions." (`gam` 18019, docs/phase7-wave3.md §3.26): restricts *this character*, not
       * the controlling player — a different attack by the same player (another ally, their own hero) is unaffected.
       * The mirror of `attackKeywords.attacker`, over the same "who is making the attack" question. Matched against
       * the attacking character itself, before `player` (if also given) narrows further by controller.
       */
      readonly attacker?: TargetQuery;
    }
  /** "Resolve each 'When Revealed' ability that you reveal 1 additional time." (Media Coverage). */
  | {
      readonly kind: "repeatWhenRevealed";
      readonly player: PlayerRef;
      readonly times: number;
      readonly while?: Predicate;
    }
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
  | {
      readonly kind: "divideBasicPower";
      readonly power: "attack" | "thwart";
      readonly target: TargetQuery;
      readonly while?: Predicate;
    }
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
   * - `basicOnly` matches only a **basic** attack — "your basic attacks gain piercing" (Red Room Training 13008,
   *   Brute Force `qsv`, Psi-Katana `psylocke`). RRG 1.8 "Basic Power" (p. 10): a basic attack is a character using
   *   its ATK, which is exactly what `attack.basic` records, so an attack an event or ability makes is excluded even
   *   when the same character makes it. The mirror of `via`, which excludes a basic attack rather than requiring one.
   *
   * All three are optional and ANDed. A rule with none of them grants the keyword to every attack in the game, which
   * no card does; `@mc/cards` should always set at least one.
   */
  | {
      readonly kind: "attackKeywords";
      readonly keywords: readonly AttackKeyword[];
      readonly attacker?: TargetQuery;
      readonly via?: TargetQuery;
      readonly basicOnly?: boolean;
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
  | {
      readonly kind: "cannotTriggerActions";
      readonly on: TargetQuery;
      readonly form?: Form;
      readonly while?: Predicate;
    }
  /**
   * "When this scheme is defeated, shuffle it into the encounter deck instead of discarding it." (Time Portal): a matching
   * side scheme that is defeated goes into the encounter deck, which is shuffled, instead of the discard pile.
   */
  | { readonly kind: "defeatedIntoEncounterDeck"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * The general form of `defeatedIntoEncounterDeck` (docs/phase7-wave3.md §3.45): a matching card that is defeated — a
   * side scheme, an ally or a minion — goes to `to` instead of its discard pile ("… shuffle it into the encounter deck
   * instead of discarding it", Time Portal, is `to: "encounterDeckShuffle"`). The constant sibling of the interrupt-time
   * `EffectSpec setDefeatDestination`, which wins when both apply (it is the more specific, later choice). The card is
   * still defeated; Victory X still sends it to the victory display.
   */
  | {
      readonly kind: "defeatDestination";
      readonly target: TargetQuery;
      readonly to: CardDestination;
      readonly while?: Predicate;
    }
  /** "The engaged player must defend against [attacker]'s attacks with an ally they control, if able" (Melter). */
  | { readonly kind: "mustDefendWithAlly"; readonly attacker: TargetQuery; readonly while?: Predicate }
  /**
   * "When Wrecker schemes, place the threat on his side scheme instead of the main scheme" — printed as a constant ★
   * ability on each Wrecking Crew villain (docs/phase7-wave1.md §3.6). A scheme activation by a matching enemy places
   * its threat on that villain's signature side scheme while it is in play, else on the main scheme.
   */
  | {
      readonly kind: "schemeThreatDestination";
      readonly enemy: TargetQuery;
      readonly scheme: "ownSignatureSideScheme";
      readonly while?: Predicate;
    }
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
  | {
      readonly kind: "excessDamageAsThreat";
      readonly source: TargetQuery;
      readonly scheme: "ownSignatureSideScheme" | TargetRef;
      readonly while?: Predicate;
    }
  /**
   * "Treat the printed text box of each [Tech] player card as if it were blank." (Tech Theft 12026, a side scheme's
   * constant): a whole *class* of cards, matched live, as against the lasting `blankTextBox` effect, which blanks a
   * fixed list of cards for a duration. A blanked card has no abilities and no printed keywords (RRG 1.8 "Blank",
   * p. 10: "the card is treated as if it had no printed text in its text box"); an attachment's printed stat box is
   * outside the text box and still applies (ruling, Apr 30, 2026 (3) answer 4).
   *
   * Read through `blankedByConstantRules` (`select.ts`), which explains why it cannot be a plain predicate in the
   * ability-lookup leaf: the rule's own target is matched on *printed* characteristics so the lookup cannot recurse,
   * and a rule never blanks its own source.
   */
  | { readonly kind: "blankTextBox"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Forced Interrupt: When an acceleration token would be placed on another scheme, place it here instead." (The
   * Master of Time 2B, 11008b; docs/phase7-wave2.md §10.3.) A constant redirect read at the moment the token is
   * placed, the same shape `schemeThreatDestination` uses for a scheme activation's threat — not an interruptible
   * event, so the placement stays synchronous and the encounter-deck reset that places most tokens (RRG 1.8
   * "Acceleration Token", p. 5) keeps its exact current ordering.
   *
   * `to` is where tokens go instead; a token already headed there is left alone, so "another scheme" cannot loop.
   * Only a main scheme stage can hold one in this model (`MainSchemeState.accelerationTokens`); a redirect to
   * anything else does nothing.
   */
  | { readonly kind: "accelerationTokenDestination"; readonly to: TargetRef; readonly while?: Predicate }
  /** "This card cannot leave play while [villain] is in play." RRG 1.8 "'Cannot'" (p. 11): absolute, like the permanent keyword. */
  | { readonly kind: "cannotLeavePlay"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Collector cannot be defeated." / "Hela cannot be defeated." (their ∞ back faces, `gmw` 16080b/16081b, `mts`
   * 21136b/21137b); "Citizen V cannot be defeated unless there are at least 1[per_hero] Thunderbolt minions in the
   * victory display" (`aos` 50129, a `while`). RRG 1.8 "'Cannot'" (p. 11) makes it absolute: a matching character at zero
   * remaining hit points is not defeated, and its pending defeat does not apply. It stops defeat only; damage is still
   * dealt and taken. docs/phase7-wave3.md §3.1.
   */
  | { readonly kind: "cannotBeDefeated"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Ronan the Accuser cannot be stunned." (Kree Fanatic, `ron` 90001). The stalwart keyword is the same rule for
   * stunned and confused (RRG 1.8 "Stalwart", p. 40: "This character cannot have confused or stunned status cards"), so a
   * matching character is never given one, and one it already holds is removed the moment the rule applies (the
   * stalwart entry's "If a character gains the stalwart keyword while they have a stunned and/or confused status card,
   * each [...] is removed"). docs/phase7-wave3.md §3.7.
   */
  /**
   * "The first [Technique] attachment revealed each round gains surge." (Nebula I–III, `gmw` 16088–16090); "The first
   * treachery the engaged player reveals each villain phase gains surge." (Mister Knife, `stld` 17026). Read once, **as
   * the card is revealed** (the reveal's faceup step), so only a rule already in play applies: FAQ "Mister Knife (#26)"
   * (RRG 1.8 p. 62): "Mister Knife was not in play when Shadow of the Past was revealed, so his ability does not cause
   * Shadow of the Past to gain surge." The revealed card must match `cards` and be the first card matching it revealed
   * this `each` period (`GameState.revealedThisRound`) — by a player `revealer` names, when given, which is resolved with
   * "you" as the rule's speaker (the engaged player, for an engaged minion). docs/phase7-wave3.md §3.8.
   */
  /**
   * "Reduce the amount of damage Nebula takes from each attack by 1." (Wide Stance, `gmw` 16098); "Reduce the amount of
   * damage attached character takes from each attack by 1." (Kree Combat Armor, 16131). A constant on the damage a
   * matching character **takes** (`fromAttack`: only an attack's): the damage dealt, and so excess damage, is unchanged
   * (ruling, Jan 26, 2026 (3)). Constants resolve before a tough status (RRG 1.8 FAQ p. 58: "A hero can keep their tough
   * status card if … A constant effect reduces the damage the hero takes to zero"). docs/phase7-wave3.md §3.15.
   */
  | {
      readonly kind: "reduceDamageTaken";
      readonly target: TargetQuery;
      readonly amount: number;
      readonly fromAttack?: boolean;
      readonly while?: Predicate;
    }
  /**
   * "Nebula cannot take more than 5 damage from a single attack." (Cutthroat Ambition, `gmw` 16094). Applied after every
   * `reduceDamageTaken`, as the last bound on what one attack's damage event makes the character take; the lowest cap
   * wins. docs/phase7-wave3.md §3.15.
   */
  | {
      readonly kind: "maxDamageTakenPerAttack";
      readonly target: TargetQuery;
      readonly amount: number;
      readonly while?: Predicate;
    }
  /**
   * "[star] Starshark's attacks deal indirect damage." (Menagerie Medley, `gmw` 16137). RRG 1.8 "Indirect Damage" (p. 24):
   * "If an enemy's attack deals indirect damage, the indirect damage is dealt during step four of the enemy activation
   * (after player's have the opportunity to defend against the attack). Only the defending character, or the attacked
   * player's identity if the attack was undefended, is considered to have been attacked, even if other characters were
   * assigned some or all of the indirect damage." docs/phase7-wave3.md §3.16.
   */
  | { readonly kind: "attacksDealIndirectDamage"; readonly attacker: TargetQuery; readonly while?: Predicate }
  /**
   * "Hero Interrupt: When your hero's attack deals any amount of excess damage, increase that amount by 1." (Follow
   * Through, Aggression, `gmw` 16045). Each matching rule adds `amount` to the excess damage an attack by a matching
   * `attacker` deals — the excess reported to "for each point of excess damage" (Into the Fray) and "after you deal
   * excess damage" (Rocket Raccoon), and the overkill damage that spills on. Modeled as a constant, not an optional
   * interrupt: see docs/phase7-wave3.md §3.18 and §4 Q10.
   */
  | {
      readonly kind: "excessDamageBonus";
      readonly attacker: TargetQuery;
      readonly amount: number;
      readonly while?: Predicate;
    }
  | {
      readonly kind: "firstRevealGainsSurge";
      readonly cards: TargetQuery;
      readonly each: "round" | "phase";
      readonly revealer?: PlayerRef;
      readonly while?: Predicate;
    }
  /**
   * "The first player controls the Milano." (`gmw` 16142): a matching card in play is always under the first player's
   * control, in their play area, and moves there when the first player token passes (RRG 1.8 "First Player", p. 19) or a
   * first player is eliminated. A continuous rule, applied between frames (docs/phase7-wave3.md §3.13).
   */
  | { readonly kind: "controlledByFirstPlayer"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "The Power Stone cannot be unattached from Ronan the Accuser." (Superior Tactics, `gmw` 16113): an effect that would
   * attach a matching attachment to another card does nothing to it while this applies (RRG 1.8 "'Cannot'", p. 11).
   * docs/phase7-wave3.md §3.19.
   */
  | { readonly kind: "cannotBeUnattached"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Forced Interrupt: When a card (player or encounter) would be placed into a discard pile from play, put it faceup into
   * The Collection instead." (Collector I–III, Infiltrate the Museum, `gmw` 16070–16072). A matching card leaving play for
   * a discard pile goes, faceup, to the scenario area `area` instead (`leavePlay`), and `discardRedirected` is announced
   * for what follows. MC16 FAQ p. 21: only a card *in play* placed *into a discard pile* — not one set aside, removed
   * from the game, shuffled into a deck, returned to hand, or discarded from an out-of-play area. RRG 1.8 FAQ "Rocket
   * Raccoon (#29A)" (p. 61): the discard was still attempted, so a cost to discard it is paid. docs/phase7-wave3.md §3.14.
   *
   * `thenPlaceThreat`: Collector III's own printed ability is one Forced Interrupt box ("…instead, then place 1 threat
   * on the main scheme"), and every villain stage's abilities are only the ones printed on that stage's own face (RRG
   * 1.8 "Villain Defeat", p. 47) — so the redirect and its follow-up have to be one `AbilityDefinition` (one ability id,
   * `16072.collector-forced-interrupt`), not the redirect plus a second card's own response to `discardRedirected` (the
   * engine's own `scenario-area.test.ts` uses two cards only to exercise the event generically). `leavePlay` places this
   * many threat on the redirecting rule's own game area's main scheme, through the ordinary interruptible `placeThreat`
   * event, immediately after announcing the redirect — so a "prevent threat from being placed" effect still applies.
   */
  | {
      readonly kind: "discardFromPlayDestination";
      readonly cards: TargetQuery;
      readonly area: string;
      readonly thenPlaceThreat?: number;
      readonly while?: Predicate;
    }
  /**
   * "You can control 1 additional upgrade that has the restricted keyword." (Venom / Flash Thompson, `vnm` 20001a/b);
   * "You can control 1 additional [Weapon] upgrade that has the restricted keyword." (Side Holster, 20021). RRG 1.8
   * "Restricted" (p. 38) fixes the limit at two; each rule raises it by `amount` for `player` (absent: the rule's speaker,
   * the card's controller). With `cards`, the extra room holds only matching cards. docs/phase7-wave3.md §3.22.
   */
  | {
      readonly kind: "restrictedLimit";
      readonly amount: number;
      readonly cards?: TargetQuery;
      readonly player?: PlayerRef;
      readonly while?: Predicate;
    }
  | {
      readonly kind: "cannotHaveStatus";
      readonly target: TargetQuery;
      readonly statuses: readonly ("stunned" | "confused" | "tough")[];
      readonly while?: Predicate;
    }
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
  readonly resourcesX?: {
    /**
     * `"any"`: "spend up to 2 resources of any type" (Nebula's Ship, `gmw` 16093): every resource paid beyond the fixed
     * requirement counts, whatever its type (docs/phase7-wave3.md §3.25).
     */
    readonly resource: TypedResource | "any";
    readonly bind: string;
    readonly min?: number;
    /**
     * "Up to 2": X is at most this. Paying more is still legal — RRG 1.8 "Cost": overpaying is allowed and the excess is
     * lost — so X is capped rather than the payment refused (docs/phase7-wave3.md §3.25).
     */
    readonly max?: number;
  };
  /**
   * "Remove 1 web counter from it →" (`target` absent/`"self"`: the ability's own card). "Remove 1 growth counter
   * from him [Groot] and exhaust Entangling Vines →" (`gmw` 16008, 16010, 16011) is `target: "identity"`: the
   * paying player's own identity, wherever the counters actually live — a different card than the one carrying
   * the ability. docs/phase7-wave3.md's Groot kit is the first printed text needing counters spent off a target
   * other than the ability's own source.
   */
  readonly spendCounters?: {
    readonly counterType: string;
    /** How many; with `upTo`, the most that may be removed. */
    readonly amount: number;
    readonly target?: "self" | "identity";
    /**
     * "Remove **up to** 4 growth counters from Groot →" ("We Are Groot", `gmw` 16006; docs/phase7-wave3.md §3.32): the
     * player chooses how many, from 1 to `amount` (and no more than the card holds), in the command's
     * `costSelection.counters`. RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game
     * elements requires a minimum of one such game element", so 0 is not a payment. With no choice given, the most
     * that can be removed is.
     */
    readonly upTo?: boolean;
    /** The number of counters removed, bound to this var for the effects ("choose that many friendly characters"). */
    readonly bind?: string;
  };
  /**
   * "Discard the top card of your deck →" (Booster Boots, `gmw` 16052; docs/phase7-wave3.md §3.33): that many cards
   * from the top of the paying player's deck go to their discard pile as the cost.
   *
   * - **Payable only if the deck can supply them all.** RRG 1.8 "Cost" (p. 13): a cost is paid in full; RRG 1.8
   *   "Player Deck" (p. 33): "If the player's deck empties while the player was discarding cards from their deck, no
   *   further cards are discarded from the newly shuffled deck", so a deck of fewer cards cannot pay more.
   * - **An empty deck is not an excuse.** The RRG never leaves a deck empty while the discard pile holds cards: "If
   *   a player deck empties, the player shuffles their discard pile to make a new deck" (p. 33), at once (ruling, Apr
   *   30, 2026 (3) answer 7: "The deck is reshuffled **before** the currently resolving card enters the discard
   *   pile"). The engine resets a deck lazily, on its next read, so an empty deck here is one the rules have already
   *   reset: it is reset first (with its facedown encounter card) and pays from the new deck. With both deck and
   *   discard pile empty there is nothing to discard, and the ability cannot be initiated.
   * - **A deck the cost empties resets immediately** (the same ruling), before the ability's effects resolve.
   */
  readonly discardFromDeck?: number;
  /**
   * "Choose to either exhaust your hero or spend 2 resources of any type →" (The Grand Collection 1B, `gmw` 16073b;
   * docs/phase7-wave3.md §3.36): pay exactly **one** of these costs, the player's choice, together with every other
   * component of this cost. The command names the branch (`costSelection.branch`, 0-based); with none, the first
   * branch that can be paid is. The ability can be initiated if any branch can be paid (RRG 1.8 "Choose (Option)",
   * p. 12: an option whose cost cannot be paid cannot be chosen), and `legalActions` lists the payable branches.
   * A branch may not itself contain `either`.
   */
  readonly either?: readonly AbilityCost[];
  /**
   * "Deal yourself 1 facedown encounter card →" (Star-Lord; Daring Escape; Library Labyrinth; Universal Weapon): the
   * paying player is dealt that many encounter cards, facedown, as the cost (docs/phase7-wave3.md §3.20).
   */
  readonly dealEncounterCards?: number;
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
   *
   * `filter` narrows *which* hand cards can pay: "Discard a [physical] resource from your hand →" (the Temporal
   * obligations, `toafk` 11018/11019/11021) is `{ printedResource: "physical" }`; "Discard a hero-specific card from
   * your hand →" (Depowered 11020) is `{ identitySetOf: you }`. Every pick must match, and a hand holding fewer than
   * `min` matching cards cannot pay the cost at all, so the ability is never offered (RRG 1.8 "Initiating Abilities",
   * p. 24, steps 3 and 5; "Cost", p. 13: a cost is paid in full). The effect-side sibling is
   * `EffectSpec discardFromHand.filter`. docs/phase7-wave2.md §19.
   */
  readonly discardFromHand?: {
    readonly min: number;
    readonly max?: number;
    readonly bind?: string;
    readonly filter?: TargetQuery;
  };
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
   * "Spend 3 resources of the same type →" (Kree Combat Armor, `gmw` 16131; docs/phase7-wave3.md §3.43): every resource
   * this cost's `resources` asks for (a generic number) must be of one type, the payer's choice. A wild counts as any
   * type; a card that generates two types can give one of them and overpay the other (`payableWithOneType`). Checked
   * wherever the payment is (`resourceVars`), so an action, a window's payment and a play all refuse a mixed payment, and
   * `legalActions` offers the ability only when the player's resources can pay it.
   */
  readonly sameResourceType?: true;
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
  /**
   * - `"player"`: "(Limit once per round **per player**.)" (The Grand Collection 1B, Library Labyrinth 16085a, `gmw`;
   *   docs/phase7-wave3.md §3.36): a shared card's ability keeps one count for each player who uses it, keyed by the
   *   ability's controller — for an encounter card's action, the player who triggers it.
   */
  readonly per?: "aspectOfEventCard" | "player";
}

/**
 * What a resource ability generates. A bare number is that many wild
 * resources; a pool is typed ("Generate a [mental] resource" → `{ mental: 1 }`);
 * `topCardOfDiscard` copies the printed resources of the top card of the
 * controller's discard pile (Pepper Potts).
 */
export type ResourceGeneration = number | Partial<ResourcePool> | { readonly kind: "topCardOfDiscard" };

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
  /**
   * Star-Lord, "What could go wrong?" (`stld` 17001a): "Interrupt: When you play a card from your hand, deal yourself 1
   * facedown encounter card → reduce the cost to play that card by 3. (Limit once per round.)" On an `interrupt` trigger
   * (its printed timing, `on: cardBeingPlayed`), this makes it a cost modifier the player opts into while playing a card
   * (`playCard.costReductionAbilities`) instead of an ability offered in that window: its cost is paid and its limit
   * counted with the play, and the card costs `amount` less (RRG 1.8 "Initiating Abilities", p. 24, step 4: "Apply any
   * modifiers to the cost(s)"). `cards` is what it may reduce; `fromHand` requires the card to be played from hand. Only
   * its controller may use it, in the trigger's `form`. docs/phase7-wave3.md §3.20 and §4 Q6.
   */
  readonly playCostReduction?: { readonly amount: number; readonly cards?: TargetQuery; readonly fromHand?: boolean };
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

export const abilityUseKey = (instanceId: InstanceId, abilityId: AbilityId): string => `${instanceId}:${abilityId}`;
