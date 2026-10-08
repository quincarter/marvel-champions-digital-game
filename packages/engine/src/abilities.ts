import type { AbilityId, KeywordInstance, SchemeIcon, Trait } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import type { PaidTypesRead, ResourcePool, ResourceRequirement, ResourceType, TypedResource } from "./resources.js";
import type {
  AbilityTimingWord,
  AttackKeyword,
  CardDestination,
  EffectSpec,
  PairLimit,
  PlayerRef,
  Predicate,
  SchemeValueName,
  StatName,
  StatusName,
  TargetCategory,
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
  /**
   * The event's source **or** one of its targets must match: "After **you** attack or defend" (Solid / Phased,
   * `mut_gen` 32031a/b) is `{ on: ["attack", "defended"], subjectIs: your identity }`, the attacker of an `attack` and
   * the defender of a `defended`, so your allies' attacks and defenses are not heard (docs/phase7-wave6.md §3.79). The
   * query counterpart of `selfIs: "either"`.
   */
  readonly subjectIs?: TargetQuery;
  readonly fromAttack?: boolean;
  /**
   * `true`: the damage must be an ally's consequential damage (RRG 1.8 "Consequential Damage", p. 13) — "When a
   * S.H.I.E.L.D. ally would take any amount of consequential damage" (Field Agent, `sm` 27044), from an attack or a
   * thwart alike. `false`: it must not be. Reads the `consequential` flag `pushConsequentialDamage` stamps on the
   * `dealDamage` event, in both windows (docs/phase7-wave5.md §4.1 Q62). On a `characterDefeated` event it reads the
   * defeat's own flag, the defeating damage's: "After an ally is defeated by consequential damage" (Med Lab, `rogue`
   * 38028; docs/phase7-wave6.md §3.57). Any other event kind never matches.
   */
  readonly consequential?: boolean;
  /**
   * `true`: the damage must be indirect damage (RRG 1.8 "Indirect Damage", p. 24), one character's assigned share of
   * it — "After a friendly character takes any amount of indirect damage" (with `requireResults: { amount: 1 }` for
   * "takes"). `false`: it must not be. Reads the `indirect` flag stamped on each share's `dealDamage` event where the
   * shares are dealt, in both windows, so it hears an ability's indirect damage, an indirect-damage cost and an enemy
   * attack that deals indirect damage alike. Any other event kind never matches.
   */
  readonly indirect?: boolean;
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
  /**
   * The attack was made by this ability (or one of these), read from the `attack` event's `sourceAbilityId`: "When you
   * use your 'Optic Blast' ability" (Full Blast, `cyclops` 33008) is `{ on: "attack", sourceAbility:
   * "33001a.cyclops-constant" }`, so an "(attack)" event's attack (Ricochet Beam 33009), made by the same identity, is
   * not heard. A basic attack, and any other event kind, never matches. docs/phase7-wave6.md §3.84.
   */
  readonly sourceAbility?: string | readonly string[];
  /**
   * The attack has one of these keywords: "When you make a **ranged** attack" is `["ranged"]`, "an attack that has a
   * keyword (overkill, piercing, or ranged)" lists all three. **Any one** listed keyword is enough. Read with
   * `attackKeywordsOf`, so the keyword may be the attacking character's (printed or granted, a grant that waited for
   * its next attack included), the attack's own ("this attack gains ranged" on the card making it), or a constant
   * `attackKeywords` rule's: RRG 1.8 "Ranged" (p. 36), "Piercing" (p. 32) and "Overkill" (p. 31) each describe "an
   * attack with the … keyword". An `attack` event only (a player's character attacking); any other kind never matches.
   *
   * Read when the pattern is matched. For an interrupt that is as the attack's interrupt window opens, where a
   * window's candidates are read once (docs/phase7-wave6.md §3.79): a keyword the attack gains from another interrupt
   * of that window (`modifyAttack.keywords`) comes too late to trigger this one, and is not read here in either
   * window. docs/phase7-wave7.md §3.59, §3.69.
   */
  readonly attackHas?: readonly AttackKeyword[];
  /** The activation the event belongs to: "while the villain attacks" / "during a scheme activation" (boost card events). */
  readonly activation?: "attack" | "scheme";
  /**
   * Numbers the event itself carries must be at least this, in both windows: `{ boostIcons: 1 }` for "cancel the boost
   * icons on that card", which cannot trigger on a card with none (FAQ "Attacrobatics (#6)", p. 59).
   *
   * On a `dealDamage` response, `{ dealt: N }` is "after X deals / is dealt N or more damage" and `{ taken: N }` (the
   * `amount` result under `requireResults`) "after X takes N or more damage": the two amounts RRG 1.8 "Prevent" (p. 35)
   * tells apart, stamped on the resolved event (`TriggerEvent dealDamage.dealt`, `.taken`). Its `amount` is what was
   * left to take once the interrupts had prevented or increased it, which is neither.
   */
  readonly eventAtLeast?: Readonly<Record<string, number>>;
  /**
   * Numbers the event itself carries must be at most this: `{ remaining: 0 }` for "When/After the last invocation counter
   * is removed from here" (Fireball, `mts` 21076; Holding Cell, `aos` 50105a; docs/phase7-wave4.md §3.15). The mirror of
   * `eventAtLeast`.
   */
  readonly eventAtMost?: Readonly<Record<string, number>>;
  /**
   * String fields the event itself carries must equal these, in both windows — the string counterpart of
   * `eventAtLeast`. `{ to: "hero" }` is "After a player changes to **hero form**" (Taskmaster 04093–04095), which
   * `formChanged`'s own `to` field already records but no pattern field could read. An event without the field, or
   * with a different value, never matches.
   *
   * Pair it with *no* `playerIs`, and the pattern is "after **a player** …" rather than "after **you** …"; the
   * effect body then names them with `PlayerRef { kind: "eventPlayer" }`.
   *
   * A list is any one of those values: `{ power: ["attack", "thwart"] }` is "When Machine Man **attacks or thwarts**"
   * (Machine Man, `vision` 26022) on `basicPowerUsing`, excluding his defense. docs/phase7-wave4.md §3.36.
   */
  readonly eventIs?: Readonly<Record<string, string | readonly string[]>>;
  /**
   * "After the enemy **with Death-Glow** is defeated" (Flight of the Valkyrior, 25008) / "after Valkyrie attacks and
   * defeats the enemy that has Death-Glow attached" (Valhalla, 25004): one of the cards attached to the defeated
   * character when its defeat was initiated (`characterDefeated.attachedInstanceIds`) matches. A defeat only;
   * docs/phase7-wave4.md §3.22.
   */
  readonly targetHadAttachment?: TargetQuery;
  /**
   * The event's player (its first player subject, `eventPlayer`) must be one of these, resolved with this card as
   * `self`: "After **the engaged player** generates any number of resources" (M.O.R.B.I.U.S., `spdr` 31027 errata, RRG
   * 1.8 p. 68) is `{ kind: "engagedWith", of: { kind: "self" } }`. An encounter card's `playerIs: "controller"` matches
   * any player, so this is how an enemy names one. docs/phase7-wave5.md §3.25.
   */
  readonly playerIn?: PlayerRef;
  /**
   * "After [this] **or** [that]": one printed ability answering either of two (or more) events, each with its own
   * conditions. The event must match this pattern's own fields **and** at least one of these full patterns, so the
   * window opens only when a whole alternative matches: "After Stryfe is defeated or the last threat is removed from
   * this scheme" (`next_evol` 40168a) is `{ on: ["characterDefeated", "removeThreat"], anyOf: [{ on:
   * "characterDefeated", targetIs: the villain }, { on: "removeThreat", selfIs: "target", requireResults: {
   * lastThreatRemoved: 1 } }] }`. RRG 1.8 "Triggering Condition" (p. 45): the ability has one condition met by either
   * occurrence, so it stays one ability with one limit.
   *
   * The outer `on` must list every kind an alternative hears (the engine reads it to decide which windows the
   * ability belongs to); fields beside `anyOf` are conditions common to every alternative. `usesAttackedPlayer` is
   * read from the outer pattern or from the alternatives that hear the event's kind. Alternatives may nest.
   */
  readonly anyOf?: readonly EventPattern[];
}

/**
 * RRG "Labeled Ability": "(attack)" / "(thwart)" / "(defense)". The player's
 * identity performs the labeled action once the ability begins resolving; a
 * stunned (attack) or confused (thwart) identity cancels the whole ability
 * except its costs. A defense label makes the identity the defender of the
 * current enemy attack if it has none (no DEF reduction, no exhaust).
 *
 * An "(attack)" ability is one attack (RRG 1.8 "Attack (Player Ability Type)", p. 10; owner ruling, 2026-10-07,
 * docs/phase7-wave8.md §4.1 Q47): once its `attack` effect, made by the controller's identity, has dealt its damage,
 * damage the ability's `dealDamage` effects deal to enemies is that attack's (attack damage dealt by the identity, each
 * enemy attacked once), and the attack finishes after the ability's last effect: retaliate from each attacked enemy
 * still in play, "after … attacks", "at the end of this attack" (`resolve/attack-ability.ts`). Damage the ability
 * deals to anything that is not an enemy stays plain damage.
 *
 * A "(thwart)" ability is a real thwart whether or not it uses the hero's THW (owner decision, 2026-10-03): threat it
 * removes from a scheme, by `removeThreat`, `divide` or `modifyAttack.removesThreat` / `removesThreatFrom` as well as
 * by `thwart`, is a `thwart` event by the controller's identity (`EffectContext.thwartLabeled`). So patrol and
 * `cannotThwart` stop it on the main scheme (RRG 1.8 "Patrol", p. 32), a scheme that player cannot thwart is no target
 * for it ("Target", p. 43), `modifyThwart` adds to each of its removals and "after you thwart" answers it. An
 * unlabeled "remove N threat" stays a plain removal.
 *
 * A "(thwart)" ability whose threat removal names no scheme its player can thwart cannot be initiated, whatever else
 * it does (owner decision, 2026-10-03; `thwartNamesNoValidScheme` in `resolve/target-validity.ts`): "remove 3 threat
 * from the main scheme. If …, return this card to your hand" is not playable under an engaged patrol minion or a
 * crisis icon. With a choice of schemes only the ones that player can thwart are offered. A scheme that becomes
 * unthwartable as the ability resolves is not thwarted: no `thwart` event of amount 0 is raised for it
 * (`thwartBlockedOn`).
 *
 * The ability is a single thwart however many instances of threat it removes (RRG 1.8 "Thwart", p. 44; owner
 * decision, 2026-10-03): "when you thwart" is heard once, as its first instance initiates, and "after you thwart"
 * once, after its last effect, on one resolved `thwart` event carrying every instance (`resolve/thwart-session.ts`).
 */
export type AbilityLabel = "attack" | "thwart" | "defense";

/**
 * An icon a card can gain or lose (`RuleSpec gainsIcon`): the scheme icons plus amplify, which the card data keeps in
 * its own count (`amplifyIcons`, RRG 1.8 "Amplify Icon", p. 7) rather than in a scheme's icon list.
 */
export type CardIcon = SchemeIcon | "amplify";

/**
 * Multiplies resources generated toward a cost (RRG 1.8 "Resource", p. 37: resources are generated "by discarding cards
 * from their hand … or by using card abilities that generate resources"; "Cost", p. 13). Two printed directions:
 *
 * - `whilePayingFor` (The Power of X: "Double the number of resources this card generates while paying for an
 *   [aspect] card"): read from the hand card being **spent**; multiplies what that card generates when the card paid
 *   for matches the query (the card whose cost is paid, per the RRG 1.8 FAQ entry for Make the Call).
 * - `forThisCard` (Lightspeed Flight, `nova` 28004: "Double the number of [wild] resources generated while paying for
 *   this card"): read from the card being **paid for**; multiplies every resource generated toward its costs from any
 *   source, a hand card or a resource ability. Resources paid for an ability on a card are paid for that card (RRG
 *   1.8 "Cost", p. 13), so it covers those too.
 *
 * `resource` narrows the multiplier to that one type ("[wild] resources"); without it every type is multiplied. A wild
 * stays wild in the pool, so each doubled wild is declared separately at payment (RRG 1.8 "Wild Resource", p. 48:
 * "When a card that generates a wild resource has its resources doubled, each of its wild resources can be declared a
 * different type"). Both directions can apply to one resource; they multiply.
 *
 * - `thisCardGenerates` (docs/phase7-wave7.md §3.80): read from the hand card being **spent**, whatever it pays for.
 *   "Double the number of resources this card generates if your identity has sustained less than 5 damage (triple the
 *   resources instead if you have sustained no damage)" is a `factor` that is a value; "This card generates 1
 *   additional [wild] resource for each acceleration token on the main scheme (to a maximum of 3 additional
 *   resources)" is `additional`. Either or both; with neither it changes nothing.
 *
 * `factor` is a number or a value read at the moment the card is spent, with "this card" as the card carrying the text
 * and "you" as the player spending it (for `forThisCard`, the player generating the resource). It is a whole number of at least 0: a
 * factor of 1 changes nothing and 0 generates none. `additional` is added to what the card generates before any
 * multiplier applies, this spec's own `factor` included (never below 0): the added resources are generated by this
 * card, so "double the number of resources this card generates" and a `forThisCard` doubling on the card paid for
 * count them. The printed resource is unchanged (ruling, January 11, 2026 - Ruling 3: a "printed resource" is the
 * icon in the bottom left corner), so an effect counting printed resources still counts one.
 */
export type ResourceMultiplierSpec =
  | { readonly factor: number | ValueSpec; readonly whilePayingFor: TargetQuery; readonly resource?: ResourceType }
  | { readonly factor: number | ValueSpec; readonly forThisCard: true; readonly resource?: ResourceType }
  | {
      readonly thisCardGenerates: true;
      readonly factor?: number | ValueSpec;
      readonly resource?: ResourceType;
      readonly additional?: { readonly resource: ResourceType; readonly amount: ValueSpec };
    };

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
  /**
   * `triggerableBy`: who may trigger it, where the card names them (docs/phase7-wave6.md §3.11): "Any player whose
   * alter-ego has the [MUTANT] trait may trigger this ability" (X-Mansion, `mut_gen` 32049), "Only the player who
   * controls Robert Kelly can trigger this ability" (Protect the Senator, 32065b). Read with "this card" as the
   * ability's card and "you" as its controller (nobody, on an encounter card). Absent, today's rule holds: an action on
   * a card a player controls is theirs, one on an uncontrolled card is the active player's, and an optional
   * interrupt/response goes to the controller, else to the player the event is about (RRG 1.8 "Ability", p. 4).
   * Present, it replaces that rule: every player it names is offered the ability, and the one who triggers it is "you"
   * for its cost, its form gate ("Alter-Ego Action", "Hero Response"), its event pattern ("After your hero defends")
   * and its effects. Its limit stays per card unless the limit says per player. Optional interrupts and responses only:
   * a forced ability is nobody's choice to trigger.
   */
  | {
      readonly kind: "action";
      readonly form?: Form;
      readonly while?: Predicate;
      readonly firstPlayerOnly?: boolean;
      readonly triggerableBy?: PlayerRef;
    }
  /**
   * "Resource:" / "Hero Resource:" — triggered while paying a cost. `forAnyPlayer`: "Piloting — Resource: Exhaust the
   * Milano → generate a [wild] resource for any player." Any player paying a cost may use it, not only its controller
   * (docs/phase7-wave3.md §3.13).
   */
  /**
   * `repeatable`: "Each toon counter on Spider-Ham can be spent as if it were a [wild] resource" (`spiderham` 30001a;
   * docs/phase7-wave5.md §3.25). An ability with no limit may be used more than once in a single payment, each use
   * paying its own cost and generating its own resources. Only a fixed `spendCounters` cost can be paid repeatedly (a
   * card exhausts once); the payment options offer one use per payable repeat (`ability:<id>:<abilityId>:<n>`).
   *
   * `spentAsIfResource`: the resources are spent, not generated (docs/phase7-wave5.md §4.1 Q5). RRG 1.8 "Cost" (p. 13)
   * and "Resource" (p. 37) name the two ways a player generates resources: discarding cards from hand and using
   * "Resource" abilities. A counter "spent as if it were a [wild] resource" is neither; the engine carries it as a
   * resource ability only so it can join a payment. It still pays (and counts toward `paid.*`), but adds nothing to
   * the payment's `resourcesGenerated` event, so "after … generates resources" (M.O.R.B.I.U.S.) does not see it.
   *
   * `while`: a resource ability that exists only under a condition — "While Brawn is exhausted, he gains: 'Resource:
   * Generate a [mental] resource. (Limit once per phase.)'" (`ironheart` 29004). While it is false the ability cannot
   * be triggered: it is not offered as a payment source and a payment naming it is refused (RRG 1.8 "Resource
   * Ability", p. 37: triggered while generating resources to pay a cost; "Play Restrictions and Permissions", p. 33).
   * Read with "this card" as the ability's card and "you" as the player spending it. Its limit (RRG 1.8 "Limit",
   * pp. 26–27) counts uses as any resource ability's does, whether or not the condition was true in between.
   */
  | {
      readonly kind: "resource";
      readonly form?: Form;
      readonly while?: Predicate;
      readonly forAnyPlayer?: boolean;
      readonly repeatable?: boolean;
      readonly spentAsIfResource?: boolean;
    }
  /**
   * `form` is the "Hero Interrupt" / "Alter-Ego Response" gate on the controller. `firstPlayerOnly`: "First Player
   * Interrupt" (Kree Command Ship, `gmw` 16108) — only the first player is offered it, and they are the one who resolves
   * it (docs/phase7-wave3.md §3.13).
   *
   * `while`: a condition on the ability itself, apart from its triggering condition: "(Limit 1 ally at a time.)" on
   * "Response: After an ally is defeated by consequential damage, exhaust Med Lab → place it here" (Med Lab, `rogue`
   * 38028; docs/phase7-wave6.md §3.57) is "while nothing is tucked here". While it is false the ability cannot be
   * initiated (RRG 1.8 "Play Restrictions and Permissions", p. 33; "Initiating Abilities", p. 24, step 2, before any
   * cost is paid at step 5): an optional one is not offered, a forced one does not resolve. Read with "this card" as
   * the ability's card, "you" as the player who would resolve it and the triggering event in scope, where the trigger
   * is gathered (`candidatesFor`) and again when an optional one is about to be offered (`stillOffered`). Where the
   * action and resource triggers' `while` is read as their card is used, this one is read as the window opens.
   */
  | {
      readonly kind: "interrupt";
      readonly forced: boolean;
      readonly on: EventPattern;
      readonly form?: Form;
      readonly while?: Predicate;
      readonly firstPlayerOnly?: boolean;
      /** Who may trigger it, when not forced: see the action trigger's `triggerableBy` (docs/phase7-wave6.md §3.11). */
      readonly triggerableBy?: PlayerRef;
      /**
       * The printed triggering condition uses "would" ("When the villain would attack you, …") where other interrupts
       * to the same event do not ("When [this enemy] attacks you, …"). RRG 1.8 "'Would'" (p. 48): it has "a higher
       * timing priority … than interrupts to the same triggering condition without the word 'would'", so the event's
       * interrupt window resolves every `would` interrupt, forced then optional and ordered among themselves as any
       * tier is, before it gathers the others; if one replaces or cancels the event, the others are never gathered
       * (docs/phase7-wave7.md §4.1, owner ruling 2026-10-06). Off by default, and set by the scripts whose text reads
       * "would attack", "would scheme" or "would be defeated" (the entry's own example is a defeat; "is defeated"
       * interrupts are the later tier). Damage and threat placement are left unmarked: every interrupt to them reads
       * "would", so they have one tier either way, after the status cards (`toughResolvesFirst`). "Would activate" is
       * its own earlier event (`enemyActivating`) and needs no marker.
       */
      readonly would?: boolean;
      /**
       * This ability does not trigger again while an earlier use of it by the same card is still resolving: while that
       * use's effects are on the stack, the card is not gathered for it, forced or not. Off by default, because the
       * RRG has no such general rule: an ability may trigger again from an event its own resolution causes, and cards
       * rely on it. Set by a script whose ability starts something that would set the same ability off again before
       * it has finished ("attached enemy attacks … Then, discard this card", Hidden in the Clutter, `next_evol` 40106:
       * the defender's retaliate during that attack would otherwise be redirected onto the card and start a second
       * attack before the first one's discard; owner ruling 2026-10-07, docs/phase7-wave7.md §4.1). The event that
       * would have triggered it resolves as if the ability were not there.
       */
      readonly notWhileResolving?: boolean;
    }
  | {
      readonly kind: "response";
      readonly forced: boolean;
      readonly on: EventPattern;
      readonly form?: Form;
      /** A condition on the ability itself: see the interrupt trigger's `while`. */
      readonly while?: Predicate;
      readonly firstPlayerOnly?: boolean;
      /** Who may trigger it, when not forced: see the action trigger's `triggerableBy` (docs/phase7-wave6.md §3.11). */
      readonly triggerableBy?: PlayerRef;
      /** Not while an earlier use of it by the same card is still resolving: see the interrupt trigger's own. */
      readonly notWhileResolving?: boolean;
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
  /**
   * "Attach to [host]. If you cannot, [effects], then attach this card to [other host]." (the Sinister Six's
   * attachments, `sm` 27103-27106): resolves in place of RRG 1.8 "Attach To"'s (p. 8) discard when an encounter
   * attachment being revealed has no legal `attachesTo` host. The card is not in play while it resolves; its own
   * effects do the attaching (`attach` with `card: self`), after which the card enters play. If they leave it
   * unattached, it is discarded as it would have been.
   */
  | { readonly kind: "cannotAttach" }
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
   *
   * `fromEntering`: the printed text is a standing condition, not a moment ("If Fantomex is not in play, discard
   * E.V.A.", `next_evol` 40021), so it also resolves when the ability is first seen with its condition already true:
   * the card entered play, flipped to this face, or got its text box back that way. RRG 1.8 "Ability" (p. 4): "A
   * constant ability becomes active as soon as its card enters play", and one that seeks a condition ("if", "while")
   * is "active anytime the specific condition is met". That first look is immediate (owner ruling 2026-10-05,
   * docs/phase7-wave7.md §4.1: E.V.A. with no Fantomex "is discarded immediately"): for a card entering play it is
   * the moment the card is in play, before any interrupt or response to its entering play is offered and before
   * anything else resolves, and a card the ability takes out of play then gets none of those windows. The condition
   * is read with the counters the card's uses keywords place as it enters (part of entering play, RRG 1.8 "Uses",
   * p. 46) counted; counters scripted as a forced response to the card's own entering play are NOT there yet, so a
   * card with such a response and a `fromEntering` condition that reads those counters needs the placement made
   * known to the engine first (`resolve/state-checks.ts`, `withUsesCounters`). After the first look the check is
   * edge-triggered like any other and never repeats while the condition stays true. Without the flag a card says
   * "when" of a change ("When all the players have joined this game area, advance"), which a condition true from
   * the start has not had.
   */
  | { readonly kind: "stateCheck"; readonly when: Predicate; readonly fromEntering?: true }
  | {
      readonly kind: "constant";
      readonly modifiers?: readonly StatModifierSpec[];
      /** "X gains retaliate 1" — keywords the matching cards gain while this card is in play. */
      readonly keywordGrants?: readonly KeywordGrantSpec[];
      /** "Captain Marvel gains the Aerial trait". */
      readonly traitGrants?: readonly TraitGrantSpec[];
      /** Rule restrictions: "cannot take damage", "threat cannot be removed", ally limit, "must defend with an ally". */
      readonly rules?: readonly RuleSpec[];
      /** "Double the number of resources …" while paying a cost: see `ResourceMultiplierSpec`. */
      readonly resourceMultiplier?: ResourceMultiplierSpec;
      /**
       * "This card generates [wild] for each ally you control (to a maximum of 3)" (Band Together, `mts` 21018): what
       * this card generates when it is spent from hand, instead of its printed resources ("you" is the spender).
       * docs/phase7-wave4.md §3.38.
       */
      readonly handGenerates?: ResourceGeneration;
      /** Changes to the cost of playing cards (docs/phase7-wave1.md §3.10). */
      readonly costModifiers?: readonly CostModifierSpec[];
      /** "You can only spend [physical] resources to pay for this card." (Crushing Blow). Read from the card being paid for. */
      readonly paymentOnly?: readonly TypedResource[];
      /** "Spend this card only in hero form." (Limitless Strength). Read from a hand card when it is spent. */
      readonly spendableIn?: Form;
      /**
       * "While your identity has the [Civilian] trait, this card can be spent for any player" (Everyday Hero, `nova`
       * 28019; docs/phase7-wave5.md §3.17): its owner may spend it from their hand toward another player's payment,
       * as for an alliance card (RRG 1.8 "Alliance", p. 6). Read from the hand card, `while` with "you" its owner. The
       * spend is announced as the owner's `resourcesSpent` with `forPlayerId` the paying player ("After you spend this
       * card for a player").
       */
      readonly spendableForAnyPlayer?: { readonly while?: Predicate };
      /**
       * "Connection to the Worldmind does not count toward your hand size." (`nova` 28007; docs/phase7-wave5.md §3.18):
       * read from the card in hand by every "cards in hand against hand size" reader (`handCountTowardHandSize`). It is
       * still a card in hand for everything else. The plan's `RuleSpec` would not be read from a hand.
       */
      readonly notCountedTowardHandSize?: true;
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
      /**
       * "Once per phase, you may play the top card of your deck as if it was in your hand, reducing its resource cost
       * by 1." (docs/phase7-wave8.md §3.49): a permission (RRG 1.8 "Play Restrictions and Permissions", p. 33) over the
       * top card of each player deck `player` names, read from a card in play like `playableAttachments`, so it is off
       * on the face that is not up and under a blank text box (RRG 1.8 "Text Box", p. 44). While it is in force and
       * its limit is not used, that top card may be played wherever a card in that player's hand could be: the play
       * command, an event in its timing window, an in-hand ability that plays its own card, and the card choice of
       * `EffectSpec playFromHand` from the hand (RRG 1.8 FAQ "Magik (#30A)", p. 64: "Any time Magik has an opportunity
       * to play a card from her hand, she may choose to play the top card of her deck instead (once per phase)").
       *
       * `costReduction` comes off that play's resource cost with every other modifier applied as usual, to a floor
       * of 0, and adds to the reduction of an effect it is played through (owner decision §4.1 Q27 = A).
       *
       * **The limit is the ability's own `AbilityDefinition.limit`** (counted in `abilityUses` and cleared at the
       * period's boundary like any other): one count per card carrying the permission, or per player it serves with
       * `limit.per: "player"`. It is used when the card leaves the deck at step 1 of initiating (RRG 1.8 "Initiating
       * Abilities", p. 24), so a play whose effects are then canceled still used it (RRG 1.8 "Limit", p. 27).
       *
       * Only playing: the card is in the deck for everything else. It is not in the hand for a count, a cost, a
       * resource or "put into play from your hand" (the FAQ's fourth entry). The card was played from the hand for
       * every reader (the FAQ's third entry); the log's `cardPlayed` carries `from: "deckTop", countsAsFrom: "hand"`.
       *
       * Independent of `RuleSpec topOfDeckFaceup`: the permission names the deck's first card whether or not a rule
       * is showing it. On the one printed card the two lines are two constants of the same face and go off together.
       */
      readonly playableTopOfDeck?: { readonly player: PlayerRef; readonly costReduction?: number };
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
  /**
   * "Mandrill gains retaliate X, where X is equal to the number of confused characters in play" (`hood` 24016), "Juggernaut
   * gains retaliate X, where X is the number of momentum counters on Juggernaut" (Head of Steam, `next_evol` 40123): the
   * granted keyword's number, read live from the granting card's point of view in place of `keyword.value`. A value of 0
   * or less grants nothing (docs/phase7-wave4.md §3.53).
   */
  readonly value?: ValueSpec;
  /**
   * "Magneto loses steady." (Physical Strain, `mut_gen` 32145b; docs/phase7-wave6.md §3.13): the matching card loses
   * every instance of `keyword.name`, printed or granted, while this applies; only the name is read. Losing beats
   * gaining (RRG 1.8 "'Loses'", p. 27). `printedKeywordsOf` still shows it: "Lost characteristics are still considered
   * to be printed on the card."
   */
  readonly loses?: true;
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

/**
 * Narrows a damage-taken rule (`reduceDamageTaken`, `increaseDamageTaken`, `preventAllDamage`) to an ally's
 * consequential damage (RRG 1.8 "Consequential Damage", p. 13; docs/phase7-wave6.md §3.31): the damage
 * `pushConsequentialDamage` deals after the ally's attack or thwart, stamped `consequential` / `consequentialFrom` on its
 * `dealDamage` event. Read where that damage is applied (`applyDamage`), so its amount is the printed icons plus any
 * `consequentialAttack` / `consequentialThwart` modifier, and the rule changes what is *taken*. A rule with this scope
 * never reaches any other damage.
 *
 * `from`: the basic power whose consequential damage it is ("from attacking", "from thwarting"), or `"any"`.
 *
 * `if`: read with the consequential damage event as the triggering event, its frame's vars as `vars` and its frame's
 * slots as `bindings`. The ally's attack/thwart reports its results into that frame as `attack.*` / `thwart.*`
 * (`made`, `damage`, `defeated`; slot `attack.damaged`, the characters it damaged; slot `attack.target`, the character
 * it attacked, damaged or not), so "after he attacks and defeats a minion" (Cannonball, `mut_gen` 32091) is
 * `varAtLeast attack.defeated` with `refMatches` on `attack.damaged`, `anywhere` since a defeated minion has left play,
 * and "when attacking attached minion" (Coordinated Attack, `cyclops` 33016) is `refMatches` on `attack.target`.
 * A thwart reports slot `thwart.target`, each scheme it thwarted (every scheme of a thwart divided across several), so
 * "after thwarting a side scheme" is `refMatches` on `thwart.target`, `anywhere` since a defeated side scheme has left
 * play by then.
 */
export interface ConsequentialDamageScope {
  readonly from: "attack" | "thwart" | "any";
  readonly if?: Predicate;
}

/** Rule restrictions a constant ability imposes (RRG "Cannot" wins over "can"). */
export type RuleSpec =
  /**
   * "X cannot take damage [while …]" (Ultron III, Madame Hydra); `fromSource`: "…from Black Panther upgrades" (Killmonger).
   *
   * `exceptFromSource`: "Goblin can only take damage from cards with a printed [physical] resource" (39043;
   * docs/phase7-wave6.md §3.68): it cannot take damage unless the damage's source card matches. That card is the one
   * the damage came through, else its source (§4 Q39, `damageSourceCard`): the event, support or upgrade whose ability
   * dealt it, an ally for its attack, the identity for a hero's basic attack; resources spent to pay never count. With
   * both fields, damage is blocked when it matches `fromSource` and not `exceptFromSource`.
   *
   * "The villain cannot take damage unless the attacker or attack has the [AERIAL] trait, or the attack has ranged."
   * (docs/phase7-wave7.md §3.30). Three exceptions that only an attack's damage can meet, each read from the attack
   * the damage belongs to (`DamageAttackInfo`); the damage gets through when any exception given holds:
   *
   * - `exceptAttacker`: the attacking character matches (the hero or ally whose attack it is, whatever card made the
   *   attack; an enemy for an enemy's attack).
   * - `exceptAttackCard`: "the attack has the trait" — the card whose ability makes the attack matches (an attack
   *   event, an upgrade's or support's attack ability). A basic attack has no such card: it is the character's own,
   *   which `exceptAttacker` reads. The RRG defines no traits for an attack itself; a trait is a card's (RRG 1.8
   *   "Traits", p. 45), so the attack's are those of the card that creates it.
   * - `exceptAttackKeyword`: the attack has the keyword, its attacker's own or granted to this attack
   *   (`attackKeywordsOf`).
   *
   * Damage that is not from an attack (an ability's or non-attack event's, retaliate, indirect damage) has neither
   * an attacker nor an attack, meets none of them and is blocked (§4.1 Q17). Overkill's spill is "damage from an
   * attack" (RRG 1.8 "Overkill", p. 31) and carries its attack's attacker, card and keywords.
   */
  | {
      readonly kind: "cannotTakeDamage";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly fromSource?: TargetQuery;
      readonly exceptFromSource?: TargetQuery;
      readonly exceptAttacker?: TargetQuery;
      readonly exceptAttackCard?: TargetQuery;
      readonly exceptAttackKeyword?: AttackKeyword;
    }
  /**
   * "Threat cannot be removed from this scheme" (Countdown to Oblivion); `by: "thwart"`: "… from attached scheme by
   * thwarting" (Held Hostage). `player`, resolved with "you" as the rule card's speaker exactly as `cannotAttack`'s own
   * field docs (docs/phase7-wave2.md §25), scopes *who* is blocked rather than restricting every player: absent, it
   * blocks any removal, as every rule before this field existed did; given, only a removal whose player (the thwart's
   * player, else the removing card's controller; a removal with neither is never scoped out) is one of `player`'s
   * players is blocked. "Players other than Gamora cannot remove threat from Sibling Rivalry" (`gam` 18025,
   * docs/phase7-wave3.md §3.26) is `{ player: others(ownerOf(gamorasIdentity)) }`.
   *
   * `exceptBy` scopes it by the removing **character** instead: "Characters other than [X] cannot remove threat from
   * [this scheme]" (docs/phase7-wave7.md §3.51) is `{ target: { self: true }, exceptBy: <X> }`. It binds only a removal
   * a character performs, and lets through the one whose character matches `exceptBy` (matched with "you" as the rule
   * card's speaker). The character is the thwarting character for a thwart, basic or "(thwart)"-labeled (RRG 1.8
   * "Labeled Ability", p. 26: a thwart "made by that player's identity", whichever card the label is on), else the
   * character the removing card acts for (`actingCharacterOf`, `select.ts`; RRG 1.8 "You, Your", p. 49). A removal no
   * character performs (a support's or a player side scheme's unlabeled ability, an encounter card that is not a
   * villain or minion, a `removeThreat.noPlayer` removal) is not bound by it (owner decision, §4.1 Q29 = A: only
   * characters are barred). Threat moved off the scheme is removed from it (RRG 1.8 "Move", p. 30) and is bound the
   * same way; threat moved onto it, threat prevented, and an effect that defeats or discards the scheme without
   * removing threat are not removals and are untouched.
   */
  | {
      readonly kind: "threatCannotBeRemoved";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly by?: "thwart";
      readonly player?: PlayerRef;
      readonly exceptBy?: TargetQuery;
    }
  /**
   * "While Baron Zemo is engaged with you, you cannot thwart." `player` is resolved with "you" as the rule card's
   * speaker (`speakerOf`). `schemes` scopes which schemes the player cannot thwart: "The engaged player cannot thwart
   * side schemes" (Life-Size Decoy, `sm` 27142) is `{ schemes: query("sideScheme") }`. Absent, every scheme, as every
   * rule before this field meant. A scoped-out scheme is not a legal target of the player's basic thwart (refused
   * before any cost, as patrol is) nor of a "(thwart)" ability (RRG 1.8 "Target", pp. 42–43: "A target that cannot be
   * thwarted is not a valid target for a thwart-labeled ability"); the player may still thwart every other scheme.
   *
   * `thwarter` scopes it to *a character* instead of (or as well as) a player (docs/phase7-wave6.md §3.77): "Attached
   * identity cannot thwart" (Wrapped in Metal, `mut_gen` 32150) restricts that identity's every thwart (basic, a thwart
   * event, a thwart ability: RRG 1.8 "You, Your", p. 49, an event's thwart is its player's identity's), while an ally the
   * same player controls still thwarts. Matched against the thwarting character with "you" as the rule card's speaker
   * (`ActiveRule.context`), so an obligation's or attachment's "your identity" is its holder's. A rule with neither
   * `player` nor `thwarter` binds every player.
   */
  | {
      readonly kind: "cannotThwart";
      readonly player?: PlayerRef;
      readonly thwarter?: TargetQuery;
      readonly schemes?: TargetQuery;
      readonly while?: Predicate;
    }
  /**
   * "Attached identity cannot thwart, attack, defend, or recover" (Wrapped in Metal, `mut_gen` 32150;
   * docs/phase7-wave6.md §3.14). `player` (resolved like `cannotThwart`'s) cannot make a basic recovery: the command is
   * refused and not offered as legal. Every "recover" in card text means the basic recovery (RRG 1.8 "Recover,
   * Recovery", p. 36; "Basic Power", pp. 10–11), so nothing else is stopped: a heal, even one equal to REC, is not a
   * recovery and only `cannotBeHealed` (§3.12) stops it.
   */
  | { readonly kind: "cannotRecover"; readonly player: PlayerRef; readonly while?: Predicate }
  /**
   * "Attached minion cannot activate" (Mental Paralysis, `phoenix` 34008; docs/phase7-wave6.md §3.34, §4.1 Q19). A
   * matching enemy's attack or scheme activation does not begin, wherever it would (RRG 1.8 "Activation", p. 6:
   * "Whenever an enemy attacks or schemes, it is considered to have activated"): the villain phase's, an effect's "X
   * attacks/schemes", quickstrike and teamwork. No boost card is dealt, no status card is spent, no interrupt to it
   * opens; logged `activationBlocked`. Its other abilities still resolve and it stays engaged. An enemy attacking
   * another enemy (`enemyAttacksEnemy`) is not an activation (wave 3 §4 Q12), so it is not stopped.
   */
  | { readonly kind: "cannotActivate"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Ignore each boost icon and each 'Boost' ability for this attack" (Aerial Agility, `angel` 42004;
   * docs/phase7-wave7.md §3.67). RRG 1.8 "Ignore" (p. 23): the ignored icon or ability is treated "as not being in
   * effect or present". Each boost card of a covered activation is still turned faceup and discarded ("Attack (Enemy
   * Activation)" step 3, p. 8; "After applying a boost card to an activation, discard it", p. 11), but it adds 0 and
   * its "Boost" ability does not resolve; logged `boostIgnored`. Every boost card is covered, however it got there:
   * the automatic one, additional ones, one dealt earlier and waiting facedown.
   *
   * No icon counts: not the printed ones, not one an amplify icon adds ("Each boost card gains [boost]", "Amplify
   * Icon", p. 7: a gained boost icon is a boost icon) and not one another effect adds for the count. Nothing is
   * canceled ("Cancel", p. 11): no `boostCancelled` entry, and a "cancel the boost icons / Boost ability" effect finds
   * nothing to cancel, so what depends on its cancel does not happen. A Boost ability that cannot be canceled is
   * ignored all the same: "'Cannot'" (p. 11) forbids the cancel and no rule forbids ignoring.
   *
   * As a lasting rule until the end of an attack (`applyRuleUntil` `"endOfAttack"`) it covers that activation alone,
   * not another that begins while it resolves (`boostIgnored`, rules.ts). On a constant ability, or with any other
   * duration, it covers every attack and scheme activation by an enemy matching `enemy` (absent = any enemy).
   */
  | { readonly kind: "ignoreBoost"; readonly enemy?: TargetQuery; readonly while?: Predicate }
  /**
   * "Ignore the Forced Interrupt on the main scheme." (No Longer Worthy, `aoa` 45105b; docs/phase7-wave8.md §3.21.)
   * While the rule is in effect, the abilities named in `abilities` on each card in play matching `on` are not there:
   * they do not trigger, an instance of one that had already triggered does not resolve (logged `abilityIgnored`), and
   * a constant one applies nothing. RRG 1.8 "Ignore" (p. 23): "An ability that ignores some ability, icon, or cost
   * treats that ability, icon, or cost as not being in effect or present while that ability is resolving"; a constant
   * ability applies for as long as its card is in play, so the named ability is absent for that long. Every other
   * ability, keyword and value of the card stays. Nothing is canceled or blanked (RRG 1.8 "Cancel", p. 11; "Blank",
   * p. 10), so an ability that cannot be canceled is ignored all the same, and text that counts blank cards does not
   * count this one.
   *
   * The rule's `while` and `on` are read from printed characteristics, and from the cards' abilities before any ignore
   * is applied: the answer does not depend on the order cards are visited, and an ignore rule is never itself ignored
   * by another.
   */
  | {
      readonly kind: "ignoreAbilities";
      readonly on: TargetQuery;
      readonly abilities: readonly AbilityId[];
      readonly while?: Predicate;
    }
  /**
   * "You take the first turn during the player phase. (When your turn is done, play proceeds in player order, starting
   * with the first player. You do not take another turn.)" (Field Commander, `cyclops` 33004; docs/phase7-wave6.md
   * §3.27). Read once, as the player phase begins (§4.1 Q16): `player` (resolved like `cannotRecover`'s) takes the
   * phase's first turn, then the rest take theirs in player order from the first player, skipping them. Only the turn
   * order moves: the first player token and every other "in player order" sequence (the end-of-phase discard, villain
   * activations, encounter cards, priority) stay as they are (RRG 1.8 "First Player", p. 19; "In Player Order", p. 24).
   * Gained mid-phase, it changes the next player phase's turns, not this one's.
   */
  | { readonly kind: "takesFirstTurn"; readonly player: PlayerRef; readonly while?: Predicate }
  /** "… cannot ready" (All Tied Up). */
  /**
   * "Prevent all damage to Ebony Maw" (Abjuration, `mts` 21082; docs/phase7-wave4.md §3.20): damage dealt to a card
   * `target` matches is dealt and prevented (RRG 1.8 "Prevent", p. 35), all of it, by the card carrying this rule —
   * which is what makes "After Abjuration prevents 2 or more damage from a single attack" a trigger on that card
   * (`TriggerEvent damagePrevented`). "Cannot take damage" (`cannotTakeDamage`) still wins over it (RRG 1.8 "'Cannot'").
   *
   * `consequential`: only an ally's consequential damage is prevented — "Until the end of the phase, prevent all
   * consequential damage each ally would take from attacking." (Group Assault, `mut_gen` 32183; Rescue Operation, 32193,
   * "from thwarting"; docs/phase7-wave6.md §3.31). Any other damage to the same character is untouched.
   */
  | {
      readonly kind: "preventAllDamage";
      readonly target: TargetQuery;
      readonly consequential?: ConsequentialDamageScope;
      readonly while?: Predicate;
    }
  /**
   * "… cannot ready" (All Tied Up). `bySource: "playerCard"`: "Heroes and allies cannot be readied by player card
   * effects" (Unnatural Storm, `mts` 21159; docs/phase7-wave4.md §3.19): only a ready caused by a player card's ability
   * is stopped; the end-of-phase ready and encounter card effects still ready them.
   */
  | {
      readonly kind: "cannotReady";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly bySource?: "playerCard";
    }
  /**
   * "Robert Kelly cannot be healed by player card effects" (Find the Senator / Protect the Senator, `mut_gen`
   * 32065a/b; docs/phase7-wave6.md §3.12). A heal of a card `target` matches heals nothing (logged `healBlocked`).
   * `bySource: "playerCard"`: only a heal whose source is a player card is stopped (an ability on a player card, a
   * player's heal cost, a basic recovery, which is the identity's own power); an encounter card's heal (Medical
   * Emergency) still heals. Without `bySource` nothing heals it. Moving damage off it is healing it (RRG 1.8 "Heal",
   * p. 22; "Move", p. 21), so a blocked move has no valid source and is not made.
   */
  | {
      readonly kind: "cannotBeHealed";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly bySource?: "playerCard";
    }
  /**
   * "As an additional cost for the engaged player to ready a hero or ally they control, the player must spend a
   * [mental] resource" (Mister Fear, `hood` 24027); "As an additional cost for a player to ready a support, that player
   * must spend 1 resource of any type" (Undermine Support, `aos` 50174). docs/phase7-wave4.md §3.19.
   *
   * RRG 1.8 "Ready" (p. 36): "If there is an additional cost for a player to ready a card, that player can choose not to
   * pay that cost. If they do not pay the cost, the card does not ready." Every ready of a card `target` matches asks
   * the player readying it (the controller at the end-of-phase ready; the resolving player for a card effect) to pay
   * `resources`; `player` narrows whose readies are taxed ("the engaged player"). Several rules add up.
   */
  | {
      readonly kind: "readyCost";
      readonly target: TargetQuery;
      /** A number is that many resources of any type (Undermine Support's "1 resource of any type"). */
      readonly resources: number | ResourceRequirement;
      readonly player?: PlayerRef;
      readonly while?: Predicate;
    }
  /**
   * "You cannot change form" (All Tied Up): the hero/alter-ego change. With `formType`, "You cannot change energy forms"
   * (Loss of Control, `mts` 21026): the additional form of that type only (docs/phase7-wave4.md §3.1). Each reading
   * blocks only its own kind of change; which additional forms a bare "cannot change form" reaches is §4 Q8.
   * `exceptSource: "self"`: a change caused by the rule's own card is not blocked — Permanently Phased (`mut_gen`
   * 32055) is in play before its When Revealed "Flip your mass form upgrade to Phased" resolves (RRG 1.8 "Reveal",
   * p. 38), and that flip still happens (docs/phase7-wave6.md Q49 = A). Every other source stays blocked.
   */
  | {
      readonly kind: "cannotChangeForm";
      readonly player: PlayerRef;
      readonly formType?: string;
      readonly exceptSource?: "self";
      readonly while?: Predicate;
    }
  /**
   * "As an additional cost to change to hero form during your turn, you must spend 2 resources of the same type"
   * (docs/phase7-wave8.md §3.63): a change between hero and alter-ego form by each player `player` names costs `cost`
   * as well. `to`: only a change that ends in that form (absent, either way); `during: "ownTurn"`: only during that
   * player's own turn. An additional form's change (`changeAdditionalForm`) is never covered.
   *
   * RRG 1.8 "Cost" (p. 14): an additional cost is paid "simultaneously with the cost that is being added to", and "if
   * they cannot pay for all of the costs at once, then they do not pay any of the costs and the effect associated
   * with the costs does not occur". So:
   *
   * - the turn's own option (the `changeForm` command; RRG 1.8 "Form, Change Form", p. 21) carries the payment and is
   *   refused without one that pays, which leaves the once-per-round change unused;
   * - a change the player makes by an ability of a player card they resolve asks them for the payment as the change
   *   resolves, and does not happen when they cannot or do not pay (§4.2 Q37 = A);
   * - a change an encounter card makes (an obligation's or a treachery's "change to alter-ego form") is not the
   *   player's to pay for: it costs nothing and happens (Q37 = A).
   *
   * The cost is the player's alone, paid for no card: a resource generated "for" a kind of card (`generatesFor`) and
   * another player's hand cannot pay it. Several rules that cover one change are all paid at once.
   */
  | {
      readonly kind: "formChangeCost";
      readonly player: PlayerRef;
      readonly to?: Form;
      readonly during?: "ownTurn";
      readonly cost: AbilityCost;
      readonly while?: Predicate;
    }
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
   * "This card does not count toward the player side scheme limit." (docs/phase7-wave7.md §3.2), the sibling of
   * `excludedFromAllyLimit`: matching player side schemes are left out of the count, so one entering play does not
   * cause a discard, and they are not among the schemes a player may discard for the limit. A constant read at the
   * check (RRG 1.8 "Player Side Scheme Limit", p. 34), not an ability that resolves.
   */
  | { readonly kind: "excludedFromPlayerSideSchemeLimit"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Your allies, upgrades, and supports enter play exhausted." (docs/phase7-wave7.md §3.36 gap 1): a constant on one
   * card that makes other cards enter play exhausted. `target` is read as each card enters play, by any route (played,
   * put into play by an effect, revealed, setup), with "you" as the rule's speaker (`speakerOf`: an attachment on an
   * identity speaks to that identity's player). RRG 1.8 "Ready" (p. 36) has cards "enter play in a ready state"; the
   * card's text replaces that (The Golden Rules, p. 4). The card is placed exhausted, not exhausted by an effect or a
   * cost, as `playFromHand.entersExhausted` places one. A card that changes controller or flips has not entered play
   * (RRG 1.8 "Enters Play", p. 18: "transitions from an out-of-play area into play").
   */
  | { readonly kind: "entersPlayExhausted"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "Exhaust each ally you control." printed with no timing trigger (docs/phase7-wave7.md §4.1, 44032): text without a
   * bold trigger is a constant ability (RRG 1.8 "Ability", p. 4), so it is a standing instruction while its card is in
   * play, not a one-time effect. A continuous rule in the family of `keepsGivingStatus`, applied between frames: every
   * card in play that `target` matches and that is ready becomes exhausted, logged `cardExhausted` once (an exhausted
   * card is not exhausted again, RRG 1.8 "Exhausted", p. 19). It covers a card already in play when the rule's card
   * enters, one that enters play, and one that changes control into the query (RRG 1.8 "Ownership and Control", p. 31:
   * a character that changes control "remains in the same state", and then this applies). `target` is matched from the
   * rule's speaker, as `cannotReady` is. Nothing is readied when the rule stops applying.
   */
  | { readonly kind: "keepsExhausted"; readonly target: TargetQuery; readonly while?: Predicate }
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
   * "[A title] cannot enter play during this game." (a campaign instruction, MC45 p. 20; docs/phase7-wave8.md §3.43.)
   * A card matching `cards` cannot enter play from out of play by any means, for any player (RRG 1.8 "'Cannot'",
   * p. 11: the restriction "is absolute, and cannot be countermanded by other abilities"):
   *
   * - it cannot be played: the play is refused before any cost is paid, for whichever destination it names
   *   (`playDestination`), by the `playCard` command and by an effect that plays a card alike;
   * - an effect that would put it into play does nothing to it, and it stays where it was
   *   (`putIntoPlayRefused { reason: "cannotEnterPlay" }`); a choice of a card to put into play does not offer it
   *   (`TargetQuery.canEnterPlay`, a cost's pick of a card to put into play), and a swap that would bring it into play
   *   is refused.
   *
   * Only entering play is stopped (RRG 1.8 "Enters Play", p. 18). The card may be in a deck, be drawn, be discarded
   * and be spent as a resource; an event is never in play (RRG 1.8 "Event", p. 18), so one that matches is played as
   * always. A card already in play is not removed, and a flip is not an entry. Match by title (`{ name }`) to cover
   * every printing. A scenario-level rule (`GameSetupConfig.scenarioRuleSpecs`), though a card may carry it.
   *
   * Not covered: an encounter card that is *revealed* and would enter play by its own reveal. No printed rule of this
   * kind names an encounter card, and the RRG gives no disposition for one (the unique rule's "it is discarded" is that
   * rule's own). Decide it when a card needs it.
   */
  | { readonly kind: "cannotEnterPlay"; readonly cards: TargetQuery; readonly while?: Predicate }
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
   * "You cannot resolve triggered abilities in your hero's printed text box. (Triggered abilities are ones with bold
   * timing triggers.)" (Induced Panic, `sm` 27153; docs/phase7-wave5.md §4.1 Q70). A triggered ability printed on a
   * card matching `on` is neither offered nor resolved: every ability with a bold timing trigger (RRG 1.8 "Ability",
   * p. 4; "Action", p. 6: an action is one too), so actions, resources, interrupts and responses, forced or not
   * (`select.ts timingWordOf`). Constants, keywords, When Revealed and the like have no timing word and are untouched.
   * `timings` narrows it to those words.
   *
   * `identityFace`: only while a matching identity shows that face ("your hero's printed text box"). An identity's
   * abilities are read from its live face (`select.ts unblankedAbilityRefs`), so the face is the text box they are
   * printed in; an alter-ego's abilities stay usable. A forced ability it stops is not initiated: "cannot" is absolute
   * (RRG 1.8 "'Cannot'", p. 11), and a forced ability that cannot resolve is skipped as one with no valid target is
   * (RRG 1.8 "Forced", p. 20).
   *
   * `player`: "Other players cannot resolve player card abilities during your turn" (docs/phase7-wave7.md §4.1,
   * 44032): only an ability one of these players would resolve is stopped, whoever controls its card (so another
   * player's use of an "any player may trigger this" ability on your card is stopped, and your own is not). The players
   * are read from the rule's speaker. An ability no player resolves (a forced ability on a card of the scenario's that
   * speaks to nobody) is never stopped by a rule with `player`. `playerCards`: only an ability on a player card (RRG
   * 1.8 "Player Card", p. 33; `select.ts isPlayerCard`), so an encounter card's abilities stay usable. A forced
   * ability on a player card is stopped like any other: the Forced entry (p. 20) makes initiation mandatory, and "If
   * two rules conflict, the rule with 'cannot' takes precedence" (p. 11).
   */
  | {
      readonly kind: "cannotResolveTriggeredAbilities";
      readonly on: TargetQuery;
      readonly identityFace?: Form;
      readonly timings?: readonly AbilityTimingWord[];
      readonly player?: PlayerRef;
      readonly playerCards?: true;
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
   * "Vision cannot attack or defend." (Intangible, `vision` 26002); "Grant Ward cannot defend." (`aos` 50022); "Each
   * character cannot defend against attached villain's attacks." (Tracking Display, `sm` 27152: `target` any character,
   * `attacker` the host). A matching character is never a legal defender (basic defense) and a "(defense)" ability
   * does not make it the defender; `attacker` limits it to that enemy's attacks. docs/phase7-wave4.md §3.31. Both
   * queries are read with "you" as the rule card's speaker (`ActiveRule.context`, docs/phase7-wave6.md §3.77), so "you
   * cannot defend" on an obligation (Permanently Phased, `mut_gen` 32055) is `target` its holder's identity.
   */
  /**
   * "Players cannot discard attachments that are attached to friendly characters." (Powerful Enchantments, `valk`
   * 25030): a matching card is not discarded by an ability a player uses (the effects frame's `byPlayer`: a player
   * card's ability, an action, an optional interrupt or response). Its host's defeat, or an encounter card's own forced
   * effect, still discards it. Narrower than `cannotLeavePlay`. docs/phase7-wave4.md §3.44.
   */
  | { readonly kind: "playersCannotDiscard"; readonly target: TargetQuery; readonly while?: Predicate }
  | {
      readonly kind: "cannotDefend";
      readonly target: TargetQuery;
      readonly attacker?: TargetQuery;
      readonly while?: Predicate;
    }
  /**
   * "When Wrecker schemes, place the threat on his side scheme instead of the main scheme" — printed as a constant ★
   * ability on each Wrecking Crew villain (docs/phase7-wave1.md §3.6). A scheme activation by a matching enemy places
   * its threat on that villain's signature side scheme while it is in play, else on the main scheme.
   *
   * A `TargetRef` names the scheme instead: "When Dark Phoenix schemes, place that threat on Consume the World, if
   * able" (34029, `named("Consume the World")`; docs/phase7-wave6.md §3.37), read from the rule card. "If able": the
   * main scheme when the ref finds no scheme in play.
   */
  | {
      readonly kind: "schemeThreatDestination";
      readonly enemy: TargetQuery;
      readonly scheme: "ownSignatureSideScheme" | TargetRef;
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
   * Excess damage is the value overkill would spill (RRG 1.8 "Overkill", p. 31, superseding ruling Jan 26, 2026 (3);
   * `resolve/event.ts` `excessDamageOf`): damage *taken* beyond remaining hit points, so a tough status card, a
   * prevention or "cannot take damage" leaves none to place (user decision 2026-09-25). See `resolve/event.ts`
   * `applyDamage` for the ordering and the open overkill question.
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
   *
   * On an **identity** ("Treat your identity's printed text box as if it were blank (except for traits)", an
   * attachment's `{ hostOfSelf: true }` or an obligation's `{ categories: ["identity"], controller: "you" }`;
   * docs/phase7-wave7.md §3.19, §4.1 Q12 = A) the blank is on the card, so whichever face shows is blank and changing
   * form restores nothing: no triggered, resource or constant ability and no keyword, on either face. Traits stay with
   * no special case (RRG 1.8 "Traits", p. 45: "not considered to be part of a card's printed text box for the purpose
   * of card abilities"), as do the stat line, hand size and hit points, which are printed outside the text box; a
   * star stat the text defines reads its printed 0 (RRG 1.8 "Star Icon", pp. 40-41). Changing form is a game rule and
   * still allowed. What an ability did before the blank stays done, and one already initiated finishes (RRG 1.8
   * "Initiating Abilities", pp. 24-25). `blank-text-box-identity.test.ts`.
   */
  | {
      readonly kind: "blankTextBox";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      /**
       * "Treat your mass form upgrade's text box as if it were blank, except for keywords." (Corrupted Programming,
       * `vision` 26028): the card keeps its printed keywords (its form keyword, so the mass form still counts as
       * one) while losing every ability. docs/phase7-wave4.md §3.28.
       */
      readonly exceptKeywords?: true;
    }
  /**
   * "This card's printed text box cannot be treated as if it were blank." (SP//dr Suit 1B and SP//dr, `spdr` 31001b /
   * 31002b; docs/phase7-wave5.md §3.31.) Neither a lasting `blankTextBox` effect (Panic in the Streets, Vivian) nor a
   * constant `blankTextBox` rule (Tech Theft) blanks the card, so its abilities and printed keywords stay live. Always
   * its own card, and unconditional as printed: no `target`, no `while`.
   *
   * Read from the card's current face *before* any blank is applied (`select.ts` `textBoxCannotBeBlanked`), since the
   * rule sits in the very text box it protects. Only the face that prints it is protected: a card flipped to a face
   * without the line can be blanked by an effect that is still lasting. Not the permanent keyword's own blank
   * protection (RRG 1.8 "Permanent", p. 32), which exempts effects from the card's own set and is not modeled yet.
   */
  | { readonly kind: "textBoxCannotBeBlanked" }
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
  /**
   * "This card cannot leave play while [villain] is in play." RRG 1.8 "'Cannot'" (p. 11): absolute, like the permanent keyword.
   *
   * `by: "cardAbilities"`: "Card abilities cannot remove this ally from play." (docs/phase7-wave7.md §3.10, §4.1 Q7.)
   * Narrower: only a move or a "defeat" resolved from a card's ability, or paid as its cost, does nothing to the card
   * (a discard, a return to hand or deck, a removal from the game, a move under another card or into the victory
   * display, a swap with a card out of play). The game's own rules still remove it: RRG 1.8 "Ally" (p. 7) tells "a card
   * ability or game effect" apart, and reaching zero hit points is "Defeat" (p. 15), whatever dealt the damage, as are
   * the ally limit's discard ("Ally Limit", p. 7), a host leaving play and player elimination (p. 34). A change of
   * control is not leaving play ("Leaves Play", p. 27: an in-play area to an out-of-play one; "Ownership and
   * Control", p. 31: the character "is moved to its new controller's play area"), so it is not stopped.
   *
   * `by: "discard"`: "[This card] cannot be discarded." (docs/phase7-wave8.md §3.35.) Narrower the other way: only a
   * discard does nothing to the card, whoever or whatever would make it. A player's card, an encounter card ("discard
   * an upgrade or support you control") and the game's own discards (a limit's "choose and discard", a host leaving
   * play, RRG 1.8 "Attach To", p. 8) all leave it in play, logged as `leavePlayBlocked`; it is no valid target for a
   * discard (RRG 1.8 "Target", p. 42) and it cannot pay a discard cost ("Cost", p. 13: paid in full or not at all).
   * A discard is a move to a discard pile (RRG 1.8 "Discard", p. 16). Every other way out of play still works: removal
   * from the game, a return to hand or deck, a move to the victory display, a swap. A flip is not leaving play at all
   * ("Flip", p. 20). A defeat is not read by this form: no card with hit points or threat prints it, and RRG 1.8
   * "Defeat" (p. 15) discards a defeated card as a consequence of the defeat, which "cannot be discarded" does not
   * prevent.
   */
  | {
      readonly kind: "cannotLeavePlay";
      readonly target: TargetQuery;
      readonly while?: Predicate;
      readonly by?: "cardAbilities" | "discard";
    }
  /**
   * "You cannot flip your [name] upgrades." (docs/phase7-wave7.md §3.64.) RRG 1.8 "'Cannot'" (p. 11): absolute. A
   * card in play matching `target` (read with the rule card's speaker as "you", `speakerOf`) is not turned to its
   * other face:
   *
   * - **by an effect** (`EffectSpec flipCard`, every kind of card it flips): that card stays as it is, logged as
   *   `flipBlocked`, and the rest of the effect resolves;
   * - **as a cost** (`AbilityCost.flipSelf`): the cost cannot be paid, so the ability cannot be initiated (RRG 1.8
   *   "Cost", p. 13);
   * - **as a target**: it is no valid target for a flip (RRG 1.8 "Target", p. 42), so a choice does not offer it, an
   *   optional "you may flip" choice with no other candidate is not asked, and a player ability that only flips
   *   cards that cannot flip is not offered (`resolve/target-validity.ts`).
   *
   * A "flip" here is a card in play turning to its other face. A change of form is not read by this rule: an
   * identity's (`changeForm`, stopped by `cannotChangeForm`), an additional form's and a villain's by-name form change
   * (`changeAdditionalForm`, `changeVillainForm`).
   */
  | { readonly kind: "cannotFlip"; readonly target: TargetQuery; readonly while?: Predicate }
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
   * matching character **takes** (`fromAttack`: only an attack's). Excess damage and overkill are measured on the
   * reduced amount (RRG 1.8 "Overkill", p. 31, superseding ruling Jan 26, 2026 (3); `resolve/event.ts`
   * `excessDamageOf`). Constants resolve before a tough status (RRG 1.8 FAQ p. 58: "A hero can keep their tough
   * status card if … A constant effect reduces the damage the hero takes to zero"). docs/phase7-wave3.md §3.15.
   */
  | {
      readonly kind: "reduceDamageTaken";
      readonly target: TargetQuery;
      readonly amount: number;
      readonly fromAttack?: boolean;
      /**
       * "… unless the attacker has the [TINY] trait." (docs/phase7-wave7.md §3.30): no reduction for an attack's
       * damage whose attacking character matches (`DamageAttackInfo`). Damage with no attacker is reduced as usual,
       * so pair it with `fromAttack` for "from each attack".
       */
      readonly exceptAttacker?: TargetQuery;
      /** Only an ally's consequential damage: "Cannonball takes -1 consequential damage after …" (§3.31). */
      readonly consequential?: ConsequentialDamageScope;
      readonly while?: Predicate;
    }
  /**
   * "While there are no other [Symbiote] environments in play, this card is considered a [Symbiote] environment."
   * (Festering Mass, `sm` 27124, a side scheme; docs/phase7-wave5.md §3.9). Each card in play matching `target` also
   * counts as each of `categories` and has each of `traits` — for `TargetQuery` category and trait matching only (a
   * "[symbiote] environment" query), never for where the card lives or how it behaves (it stays a side scheme).
   *
   * `while` is read with printed characteristics only (no constant grants, this rule included), so "no other
   * [Symbiote] environments" never asks itself. RRG 1.8 has no rule for a modifier whose condition depends on its own
   * result; this is the `traitsOf` / `blankTextBox` reading (docs/phase7-wave2.md §17.5).
   */
  | {
      readonly kind: "countsAs";
      readonly target: TargetQuery;
      readonly categories: readonly TargetCategory[];
      readonly traits?: readonly Trait[];
      readonly while?: Predicate;
    }
  /**
   * "As an additional cost to thwart this scheme, take 2 indirect damage" (Cat in a Tree, `spiderham`); "… you must spend
   * a [energy] resource" (Giant Monster Attack, `spdr`; docs/phase7-wave5.md §3.21). Every thwart of a scheme `scheme`
   * matches asks the thwarting player, before it resolves, to spend `resources` (which they may decline; the thwart is
   * then cancelled) and then to take `indirectDamage`. Several rules add up. §4.1 Q18: a player who cannot pay it
   * cannot choose the scheme as a thwart's target (`thwartCostPayable`, `thwart-cost.ts`); declining at resolution
   * still cancels the thwart, the fallback when what they could pay with is gone by then.
   */
  | {
      readonly kind: "additionalThwartCost";
      readonly scheme: TargetQuery;
      readonly resources?: ResourceRequirement;
      readonly indirectDamage?: number;
      readonly while?: Predicate;
    }
  /**
   * "Treat the printed resource of each card in your hand as if it were [energy]." (Haywire, `ironheart` 29038;
   * docs/phase7-wave5.md §3.20): every printed resource icon of each card in the hand of each player `player` names
   * (read from the rule's speaker, the identity it is attached to) counts as one `as` resource, wild included — for
   * paying and for every printed-resource reader (`printedResourcesOf`). A card outside that hand is unchanged.
   */
  | { readonly kind: "printedResourceAs"; readonly player: PlayerRef; readonly as: TypedResource }
  /**
   * "When counting resources on cards discarded from the top of your deck, count each printed [wild] icon twice."
   * (docs/phase7-wave7.md §3.56): each printed `resource` icon of a card an ability discarded from the deck of a
   * player `player` names (read from the rule's speaker) counts `times` times when that ability counts its icons, by
   * the `<bind>.<type>` totals of a `moveCards` and by `ValueSpec totalPrintedResources` (`countedResourcesOf`). Any
   * effect or cost that discards from that deck (owner decision, §4.1 Q31 = A); a card a response took away is no
   * longer among the cards counted (§4.1 Q32 = B).
   *
   * The icon keeps its type: MC40 p. 21, "each [wild] discarded this way is treated as two [wild] icons", so a count
   * by type reads two wilds, and nothing makes them another type (RRG 1.8 "Wild Resource", p. 48: "When resources are
   * not being generated for a cost, a wild resource does not have any characteristic other than 'wild resource'").
   * It is a count, not a change of the card: paying with the card, a type test on it (`TargetQuery.printedResource`,
   * `ValueSpec resourceTypes`) and a count of cards that did not come from that deck read the printed icons.
   */
  | {
      readonly kind: "deckDiscardIconCount";
      readonly player: PlayerRef;
      readonly resource: ResourceType;
      readonly times: number;
    }
  /**
   * "Armadillo can have any number of tough status cards." (`nova` 28029; docs/phase7-wave5.md §3.19): RRG 1.8 "Status
   * Cards" (p. 41) allows one of each; a matching character may hold any number of `status`. Each tough card still
   * prevents one damage event and is discarded alone (RRG 1.8 "Tough"); piercing discards them all. A number is a
   * total: "Colossus can have 1 additional tough status card." (`mut_gen` 32001a; docs/phase7-wave6.md §3.7) is `2`.
   * With several matching rules the largest wins; `cannotHaveStatus` still wins over all of them.
   */
  | {
      readonly kind: "statusLimit";
      readonly target: TargetQuery;
      readonly status: "tough";
      readonly max: "unlimited" | number;
    }
  /**
   * "Increase all damage Venom takes by 1." (Bell Tower's Ringing side, `sm` 27076b; docs/phase7-wave5.md §3.8): the
   * mirror of `reduceDamageTaken`, once per damage event (§4 Q7). Summed with the reductions before the result is
   * floored at zero and before any cap (RRG 1.8 "Modifiers", p. 29: additive and subtractive modifiers are applied
   * simultaneously, and a value below zero is treated as zero). A damage event of 0 is not increased: nothing is taken.
   */
  | {
      readonly kind: "increaseDamageTaken";
      readonly target: TargetQuery;
      readonly amount: number;
      readonly fromAttack?: boolean;
      /**
       * Only damage whose source card matches (§4 Q39, `damageSourceCard`): "Troll takes 1 additional damage from each
       * card with a printed [mental] resource" (39044; docs/phase7-wave6.md §3.68), once per damage event (§4 Q7).
       */
      readonly fromSource?: TargetQuery;
      /** Only an ally's consequential damage: "Dust takes +1 consequential damage after this attack" (§3.31). */
      readonly consequential?: ConsequentialDamageScope;
      readonly while?: Predicate;
    }
  /**
   * "Double the amount of damage this minion takes from cards with a printed [energy] resource" (Dragon, 39042);
   * "Attacks with piercing deal double damage to Vampire" (Vampire, 39051; docs/phase7-wave6.md §3.68). RRG 1.8
   * "Modifiers" (p. 29): every additive and subtractive modifier is calculated before doubling, so the damage is doubled
   * after every increase and reduction (an interrupt's, already in the event's amount, and every constant's), and before
   * `maxDamageTakenPerAttack` and the sustained/per-phase caps (§3.3, §3.4). A damage event of 0 stays 0. Logged as
   * `damageDoubled`.
   *
   * `fromSource`: only damage whose source card matches (§4 Q39, `damageSourceCard`). `attackKeyword`: only an attack's
   * damage to the character it attacks, when the attack has that keyword (its attacker's, or granted to the attack;
   * `attackKeywordsOf`). Several matching rules each double (×2 per rule): no card pairs two yet, and the RRG does not
   * say otherwise.
   */
  | {
      readonly kind: "doubleDamageTaken";
      readonly target: TargetQuery;
      readonly fromSource?: TargetQuery;
      readonly attackKeyword?: AttackKeyword;
      readonly while?: Predicate;
    }
  /**
   * "Nebula cannot take more than 5 damage from a single attack." (Cutthroat Ambition, `gmw` 16094). Applied after every
   * `reduceDamageTaken`, as the last bound on what one attack's damage event makes the character take; the lowest cap
   * wins. docs/phase7-wave3.md §3.15.
   *
   * `per: "phase"`: "Nimrod cannot take more than 3 damage each phase." (`mut_gen` 32166; docs/phase7-wave6.md §3.4).
   * Every damage event counts, attack or not, against `CardInstance.damageTakenThisPhase` (damage taken only: prevented,
   * reduced, tough-absorbed and capped damage do not count, §4.1 Q9), and what would go past `amount` is held back the
   * way `maxSustainedDamage` holds it: neither taken nor prevented, logged as `damageCapped`, no tough card used, no
   * excess (RRG 1.8 "Overkill", p. 31). Damage *placed* is not damage taken (RRG 1.8 "Damage", p. 14: a character takes
   * damage when damage is dealt to it; `placeDamage` likewise ignores "cannot take damage"), so it neither counts nor is
   * held. Absent `per` is `"attack"`.
   */
  | {
      readonly kind: "maxDamageTakenPerAttack";
      readonly target: TargetQuery;
      readonly amount: number;
      readonly per?: "attack" | "phase";
      readonly while?: Predicate;
    }
  /**
   * "Magneto cannot have more than 6[per_hero] sustained damage." (Boarding Party, Sabotage Master Mold, Orbital Decay;
   * docs/phase7-wave6.md §3.3). Sustained damage is maximum minus remaining hit points (RRG 1.8 "Sustained Damage",
   * p. 42), which for every character is its `damage`. Read where damage is taken, after every reduction, increase and
   * per-attack cap and before a tough status card: the damage taken is lowered to what keeps sustained damage at most
   * `amount` (read live from the rule's card); with several rules the lowest wins. Damage placed (not dealt) is held to
   * it too. Damage above the cap is neither taken nor prevented (§4.1 Q9): it announces no `damagePrevented` and uses
   * no tough card, and it yields no excess damage (measured on damage taken, RRG 1.8 "Overkill", p. 31). It never heals and never changes maximum hit
   * points.
   */
  | {
      readonly kind: "maxSustainedDamage";
      readonly target: TargetQuery;
      readonly amount: ValueSpec;
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
   * "[star] Divide damage from Bombshell's attack among each character the attacked player controls as evenly as
   * possible." (Iron Spider's Sinister Syndicate, `spdr` 31031). Step 5 of a matching enemy's attack (RRG 1.8 "Attack
   * (Enemy Activation)", p. 9) is replaced: step 4's damage (after a hero defender's DEF) is divided among the target
   * player's identity and the allies they control, `EffectSpec divideDamageEvenly`. The golden rule (RRG 1.8 p. 4)
   * puts the card over step 5's "all damage … is dealt to the ally", so an ally defender takes one share, not all.
   * Only the defender, or the target character if undefended, is attacked, as with `attacksDealIndirectDamage`.
   */
  | { readonly kind: "attacksDividedEvenly"; readonly attacker: TargetQuery; readonly while?: Predicate }
  /**
   * "Each enemy in play gains 1 acceleration icon" (Secret Lair, `hood` 24061; Coordinated Effort, `sm` 27143; Mad
   * Science, `aos` 50085; Bora, `spdr` 30031; Mojo in the Middle, `mojo` 39060), "this card gains a hazard icon" (Rule by
   * Force, `sm` 29029): each card in play matching `target` counts as printing `count` more `icon`s (RRG 1.8
   * "Acceleration Icon", p. 5: "the number of acceleration icons in play"). docs/phase7-wave4.md §3.57.
   *
   * `loses: true` is the opposite: "While there is no threat here, this scheme loses the [amplify] icon" (Consume the
   * World, 34030; docs/phase7-wave6.md §3.38). A matching card shows none of `icon`, printed or gained, and `count` is
   * ignored. Losing beats gaining: a lost characteristic "cannot be regained while the ability causing it to be lost is
   * in effect" (RRG 1.8 "'Loses'", p. 27), the same order `KeywordGrantSpec.loses` keeps (§3.13).
   */
  | {
      readonly kind: "gainsIcon";
      readonly icon: CardIcon;
      readonly target: TargetQuery;
      readonly count?: number;
      readonly loses?: true;
      readonly while?: Predicate;
    }
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
   * "While White Queen is engaged with you, you are confused." (`mut_gen` 32056); "While Telepathic Restraint is
   * attached to your identity, you are stunned." (32059). A continuous rule, applied between frames (docs/phase7-
   * wave6.md §3.9): each matching character in play holding fewer `status` cards than it may (`statusCapacity`: steady
   * two, stalwart or `cannotHaveStatus` none) is given real status cards up to that, logged `statusGiven` with
   * `reason: "constant"`. `target` is matched from the rule's speaker (`speakerOf`: an engaged minion's player, an
   * attachment's host's controller), so `controlledBy: { kind: "controller" }` is "you".
   *
   * RRG 1.8 FAQ "White Queen (#56)" (p. 63): "she continuously places confused status cards on the engaged player's
   * identity until that identity cannot have any more"; a thwart attempt removes them "but will immediately be given
   * more"; "When White Queen leaves play, any confused status cards remain" — so nothing is taken back when the rule
   * stops applying (leaving play or disengaging alike).
   */
  | {
      readonly kind: "keepsGivingStatus";
      readonly target: TargetQuery;
      readonly status: StatusName;
      readonly while?: Predicate;
    }
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
  | { readonly kind: "notDefeatedWithoutThreat"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * "While a [MISSION] side scheme is in play, when a player plays an ally, they must choose: either play that ally
   * into their game area per the normal rules of the game, or play it into the mission area." (MC45 p. 5;
   * docs/phase7-wave8.md §3.34.) While the rule is in effect and the in-play scenario area `area` exists, a player who
   * plays a card matching `cards` may name the area as the play's destination (`playCard.into`; `legalActions` lists
   * it as `LegalAction.destinations`). A choice between two legal plays, not a forced move: without `into` the card is
   * played as always. Its cost, play restrictions, "max per", the unique rule and `cannotPlay` are checked as for any
   * play (RRG 1.8 "Play, Put into Play", p. 32), before the destination matters, and it is a play: "after you play an
   * ally" answers it. Only a play has the choice: a card an effect plays or puts into play goes to its player's area.
   *
   * There the card is in play under no player's control (`placeInScenarioPlayArea`): the ally limit counts allies a
   * player controls (RRG 1.8 "Ally Limit", p. 7), and no player can exhaust it or attack, thwart or defend with it.
   *
   * `attachments`: "Players may attach upgrades to allies in the mission area." A player upgrade matching it may take a
   * card in the area as its host when its own "attach to" text allows that card: the host choice reaches into the
   * area (`attachmentReachOf`), however the upgrade enters play. The upgrade is then in the area with its host, under
   * no player's control. Whether its abilities do anything there is the closed area's question, not this rule's
   * (`AbilityDefinition.reaches`, §4.1 Q19 = B).
   */
  | {
      readonly kind: "playDestination";
      readonly cards: TargetQuery;
      readonly area: string;
      readonly attachments?: TargetQuery;
      readonly while?: Predicate;
    }
  /**
   * "The unique rule does not apply to Avengers Tower." (Avengers Tower, Stronghold side, `mts` 21100a): while this is in
   * play, a card titled `title` entering play is never refused by the unique rule (RRG 1.8 "Unique Icon", pp. 45–46).
   * MC21 p. 11: "This constant ability allows each player to play the Avengers Tower support card and use its ability
   * while the Avengers Tower environment card Stronghold side is in play." By printed title, since the entering card is
   * not in play yet. docs/phase7-wave4.md §3.5.
   */
  | { readonly kind: "uniqueRuleExempt"; readonly title: string; readonly while?: Predicate }
  /**
   * Focused Defense (Tower Defense, `mts` 21101), attached to one of the two main schemes: "The villain who matches the
   * attached scheme is the active villain." With it, the same scheme is the one MC21 names by the attachment: "If a
   * constant effect on a player card refers to 'the main scheme,' that card always refers to the scheme card with the
   * attachment 'Focused Defense' attached to it" (MC21 p. 10), and "When a minion schemes, that threat is placed on the
   * main scheme with the attachment 'Focused Defense' attached to it" (errata, RRG 1.8 p. 67). `scheme` names that main
   * scheme (`host`, on the attachment). Applied between frames: the villain whose title the scheme's `villainOf` names is
   * made active (`activeVillainChanged { reason: "focusedScheme" }`). docs/phase7-wave4.md §3.2.
   */
  | {
      readonly kind: "focusedMainScheme";
      readonly scheme: TargetRef;
      readonly while?: Predicate;
      /**
       * `focused`: encounter cards' "the main scheme" is the focused scheme alone, and so are the acceleration tokens
       * placed "on the main scheme" (by any card, and by the empty encounter deck), the villain's scheme threat, and the
       * main scheme the crisis icon and patrol protect. Venom Goblin's glider counter, MC27 p. 17: "When threat would be
       * placed on 'the main scheme' by an enemy activation, card ability, or acceleration icon, place it on the scheme
       * with the glider counter. Additionally, when an acceleration token would be placed on 'the main scheme,' place it
       * on the scheme with the glider counter. Any encounter card that refers to 'the main scheme' without a qualifier
       * refers to the main scheme with the glider counter."; FAQ (RRG 1.8 p. 62; MC27 p. 21) on player acceleration
       * tokens, patrol and crisis. Absent: Tower Defense's reading (an encounter card's "the main scheme" is every one).
       * docs/phase7-wave5.md §3.3.
       */
      readonly encounterCards?: "focused";
    }
  /**
   * "Odin cannot have cards attached" / "Odin cannot have encounter cards attached" (Odin, `mts` 21139a/b; with Odin
   * attached to the main scheme, ruling Aug 3, 2026 (4) #1: "Odin cannot have attachments while attached to the main
   * scheme"); "Robert Kelly … cannot have upgrades attached" (Find the Senator, `mut_gen` 32065a). A matching card is no
   * legal host for an attachment or upgrade from `from` (absent: any card; `"encounter"`: an encounter card; `"upgrade"`:
   * a player upgrade; `"playerCard"`: any card a player owns, "He … cannot have player cards attached", Robert Kelly
   * 32066), and an `attach` effect leaves such a card where it was. docs/phase7-wave4.md §3.8.
   */
  /**
   * "Treacheries cannot be canceled." (Dark Scepter, `tt` 55036, in play); "In expert mode, this card gains incite 1 and
   * cannot be canceled." (Frequent Flyers and its three siblings, `sm` 27108–27110, 27112, read from the revealed card
   * itself: `cards: { self: true }` with a mode `while`). A matching card being revealed cannot have its effects or its
   * "When Revealed" effects canceled. docs/phase7-wave4.md §3.14.
   */
  | { readonly kind: "cannotBeCanceled"; readonly cards: TargetQuery; readonly while?: Predicate }
  /**
   * On an attachment: "Treat attached ally as an [Undead] minion with a blank text box. Attached minion's SCH is equal
   * to its printed THW and it does not take consequential damage." (Fallen Warrior, Beguiled, `mts` 21153, 21178;
   * 'Pool-ized, `deadpool` 44041; "Lost" Child, `jubilee` 47027; Possessed, `storm` 36038; Manipulated Mind, `sm`
   * 27171 and Malice, `next_evol` 40199, "(except for traits)" → `keepPrintedTraits`). Read as the attachment arrives
   * on or leaves an ally (`CardInstance.treatedAs`); a minion takes no consequential damage by definition, so that
   * clause needs nothing. docs/phase7-wave4.md §3.9.
   *
   * The card carrying the rule is whatever is attached to the ally: an attachment, or a minion its own When Defeated
   * attached there (Malice; `isAttachedMinion`, docs/phase7-wave7.md §3.44).
   *
   * `schFromThw`: `true` is "Attached minion's SCH is equal to its **printed** THW"; `"current"` is "… equal to its
   * THW" (Malice), the ally's THW as it stands whenever its SCH is read: its base THW plus every THW modifier that
   * still applies to the card now that it is a minion (§4.1 Q27). SCH modifiers apply on top of either.
   */
  /**
   * "While in hero form, Nebula ignores the guard keyword, the patrol keyword, and the crisis icon." (Evasive
   * Maneuvering, `nebu` 22005); "Wasp ignores the guard keyword, patrol keyword, and crisis icon" (`ironheart` 29034);
   * Shadowcat, ally and Phased form (`mut_gen` 32002, 32030a); "Psylocke ignores the guard and patrol keywords"
   * (Psionic Training, `psylocke` 41010). A standing exemption a character carries, not one effect's: a matching
   * character's attacks are not stopped by guard, and its thwarts (basic or "(thwart)", the thwart's own character)
   * are not stopped by patrol or the crisis icon; a removal whose source is the character itself skips the crisis icon
   * too. RRG 1.8 "Ignore" (p. 23). docs/phase7-wave4.md §3.24.
   *
   * `"retaliate"`: "Attached villain … ignores the retaliate keyword while attacking a non-[AERIAL] character."
   * (docs/phase7-wave7.md §3.30): a matching character's attacks are not answered by the attacked character's
   * retaliate, as an attack with ranged is not (RRG 1.8 "Ranged", p. 36; "Retaliate X", p. 38).
   *
   * `against`: the rule holds only for an attack against a character matching it. Only retaliate is read with an
   * attacked character, so a rule with `against` never waives guard, patrol or the crisis icon.
   */
  | {
      readonly kind: "characterIgnores";
      readonly target: TargetQuery;
      readonly ignores: readonly ("guard" | "patrol" | "crisis" | "retaliate")[];
      readonly against?: TargetQuery;
      readonly while?: Predicate;
      /**
       * Only for the character's basic thwarts: "your hero's basic thwarts ignore the crisis icon" (Retinal Display,
       * `sm` 27186a/b; docs/phase7-wave5.md §3.22). An ability's thwart or attack is not exempted.
       */
      readonly basicOnly?: true;
    }
  /**
   * "Your hero's basic thwart power (THW) can only remove threat from the scheme with the most threat." (Retinal
   * Display, `sm` 27186a/b; docs/phase7-wave5.md §3.22): a basic thwart by a character `character` matches may target
   * only a scheme `among` names now (read from the rule's card, so "the scheme with the most threat" is a
   * `superlative` ref; ties leave every tied scheme). Several rules all apply.
   */
  | {
      readonly kind: "basicThwartTargets";
      readonly character: TargetQuery;
      readonly among: TargetRef;
      readonly while?: Predicate;
    }
  /**
   * On an upgrade attached to a minion: "Take control of attached minion and treat it as a [Controlled] ally with a
   * blank text box. Its THW is equal to its printed SCH and it takes 1 consequential damage after it thwarts or
   * attacks." (Mind Control, `phoenix` 34009; Redemption, `bp` 51036). The attachment's controller takes control.
   * `CardInstance.treatedAs` kind `ally`; docs/phase7-wave4.md §3.29.
   */
  | {
      readonly kind: "treatHostAsAlly";
      readonly traits: readonly Trait[];
      readonly thwFromSch?: boolean;
      readonly consequential: number;
    }
  | {
      readonly kind: "treatHostAsMinion";
      readonly traits: readonly Trait[];
      readonly keepPrintedTraits?: boolean;
      readonly schFromThw?: boolean | "current";
    }
  | {
      readonly kind: "cannotHaveAttachments";
      readonly target: TargetQuery;
      readonly from?: "encounter" | "upgrade" | "playerCard";
      readonly while?: Predicate;
    }
  /**
   * "If Odin leaves play, the players lose the game." (Odin, Captive side, `mts` 21139a); "If Robert Kelly leaves play …"
   * (Stalked by Sabretooth, `mut_gen` 32063); "If Hope Summers leaves play …" (`next_evol` 40130). The moment a matching
   * card leaves play the game ends as a loss. Moving between play areas or being detached is not leaving play.
   * docs/phase7-wave4.md §3.8.
   */
  | { readonly kind: "leavingPlayLoses"; readonly target: TargetQuery; readonly while?: Predicate }
  /**
   * Ebony Maw's Spell environments (MC21 p. 6): "When a player reveals a Spell environment, they place that card in front of
   * them in their play area", and stage 1B "puts that card into play in their play area". A matching environment that is
   * revealed or put into play goes to that player's play area, controlled by no one, instead of the villain's area. A
   * scenario rule, carried by the scenario's own cards. docs/phase7-wave4.md §3.16.
   */
  | { readonly kind: "entersRevealersPlayArea"; readonly cards: TargetQuery; readonly while?: Predicate }
  /**
   * "You cannot choose to discard this card from your hand." (System Shock, `mts` 21185). On a constant with `activeIn:
   * "hand"`, it keeps the card itself out of every discard its owner chooses from hand (an effect's "discard N cards",
   * a cost, the end-of-phase discard, the mulligan). A random discard can still take it. docs/phase7-wave4.md §3.13.
   */
  | { readonly kind: "cannotChooseToDiscard" }
  /**
   * Mystique's treacheries (Infiltration, Shapeshifter Surprise, `mut_gen` 32082-32083; MC32 p. 7): an encounter card
   * `cards` matches, drawn from a player's deck, stays in that player's hand: the wave 5 §4.1 Q4 fallback
   * (`dealUnhandledEncounterCard`) neither deals it nor draws a replacement. "Drawing a treachery card from your deck
   * counts as drawing a card"; it leaves the hand when its player discards it, as any card in hand is discarded, and
   * goes to the encounter discard pile. Discarded from the deck instead, it is not dealt either and stays in the
   * encounter discard pile ("When you discard a treachery card from your hand or deck, it is placed in the encounter
   * discard pile"). Its "After this card enters your hand" ability is an `activeIn: "hand"` response to its own
   * `cardEntersHand` (`selfIs: "target"`), however it enters. Read from rules in play and the scenario's, and
   * from the drawn card's own hand-active constant (matched against itself). docs/phase7-wave6.md §3.10, §4.1 Q7.
   */
  | { readonly kind: "staysInHand"; readonly cards: TargetQuery; readonly while?: Predicate }
  /**
   * "Until the end of the round, you may look at the top card of the encounter deck at any time." (Sector Scan;
   * docs/phase7-wave5.md §3.28): each player `player` names may read the face of the top card of the encounter deck
   * (the active villain's, as every "the encounter deck" effect reads it). Changes no game state; read only by
   * `faceVisible` for that player's own view, so it never shows the card to another player (RRG 1.8 "Look,
   * Looked-At", p. 27). Carried by `applyRuleUntil`, which freezes `player` to the resolving player.
   */
  | { readonly kind: "mayLookAtTopOfEncounterDeck"; readonly player: PlayerRef; readonly while?: Predicate }
  /**
   * "Play with the top card of your deck faceup." (docs/phase7-wave8.md §3.48): while the rule is in force the top card
   * of each player deck `player` names is visible to every player (`faceVisible`, `shownDeckTop`). Which card that is
   * comes from the deck's order and this rule each time it is asked: nothing is written on the card, whose `faceup`
   * stays false, so a save, a replay and a reconnect cannot disagree. It is not a look, a reveal or a search (RRG 1.8
   * "Look, Looked-At", p. 27): nothing triggers, the deck's order does not change (p. 33 "Player Deck") and the card is
   * still in the deck for every rule. RRG 1.8 FAQ "Magik (#30A)" (p. 64): when the top card leaves, "she turns the new
   * top card of her deck faceup" at once, so the log's `deckTopShown` / `deckTopHidden` follow every card move
   * (`announceDeckTops`).
   *
   * A constant like any other: off while its `while` is false, on the face that is not up, and under a blank text box
   * (RRG 1.8 "Text Box", p. 44). Off, the card is facedown again and satisfies no condition that reads it
   * (`Predicate topOfDeckFaceup`; owner decision §4.1 Q26 = B).
   */
  | { readonly kind: "topOfDeckFaceup"; readonly player: PlayerRef; readonly while?: Predicate }
  /**
   * "Attached villain … is considered to have at least 1 hit point." (docs/phase7-wave8.md §3.10, owner decision §4.1
   * Q6 = A): a floor on what every reader sees as a matching character's remaining hit points. The dial and the damage
   * on the card are untouched: damage is still dealt and taken, and healing still heals. While the rule is in force
   *
   * - `ValueSpec remainingHp`, and so every predicate built on it ("if he has at least 1 hit point", "while another
   *   villain has at least 1 hit point"), reads at least `atLeast` (`consideredRemainingHitPoints`);
   * - with `atLeast` of 1 or more the character does not have "zero or fewer remaining hit points" (RRG 1.8 "Defeat",
   *   p. 15), so the defeat check does not defeat it. It is watched like a character under "cannot be defeated"
   *   (`GameState.heldAtZero`) and falls the moment the rule ends with the dial still at zero. A defeat by an effect
   *   that says "defeat" does not read the dial and is not stopped.
   *
   * Read from the true dial, not through the floor: a host chosen by remaining hit points ("attach to the villain with
   * the fewest hit points", `SuperlativeHost`), excess damage (RRG 1.8 "Excess Damage", p. 19), the cap on assigned
   * indirect damage and the dial a preview shows (`CounterSnapshot.remainingHitPoints`, beside which `consideredHp`
   * reports the floor).
   *
   * A rule's own `while` that reads remaining hit points reads the true dial for the character it is deciding about,
   * so a floor cannot hold itself up.
   */
  | {
      readonly kind: "consideredRemainingHp";
      readonly target: TargetQuery;
      readonly atLeast: number;
      readonly while?: Predicate;
    }
  /**
   * "Attached ally … is considered to have a wild ([wild]) resource icon in addition to its printed resource icon."
   * (Desperate Measures, `aoa` 45176; docs/phase7-wave8.md §3.42.) A card in play matching `target` has one more
   * `resource` icon than the face it shows prints, for every reader of the icons of a card **in play**
   * (`rules.ts` `resourceIconsInPlay`): today the pairing of discarded cards with characters by resource icon
   * (`EffectSpec pairCards`, §3.36). Each rule in force adds one icon, so two add two.
   *
   * It is not a printed icon (RRG 1.8 "Printed", p. 34) and it changes nothing a card pays with: resources are
   * generated by a card discarded from a hand or by a resource ability (RRG 1.8 "Resource", p. 37), and the card this
   * rule names is in play.
   */
  /**
   * "Players cannot assign cards with the same resource icon … to more than one ally each mission attempt." (Mister
   * Sinister, `aoa` 45179a; docs/phase7-wave8.md §3.36.) While in force, every pairing (`EffectSpec pairCards`) whose
   * characters are the ones in the in-play scenario area `area` (its `with` query names that area) is held to
   * `limit`: an assignment that breaks it is refused and the choice stays open, so a card the limit forbids is left
   * unassigned.
   */
  | { readonly kind: "pairLimit"; readonly area: string; readonly limit: PairLimit; readonly while?: Predicate }
  | {
      readonly kind: "consideredResourceIcon";
      readonly target: TargetQuery;
      readonly resource: ResourceType;
      readonly while?: Predicate;
    }
  /**
   * A card in play reads the resource types that paid for another card: "After you play a THWART event, … remove 1
   * threat from that scheme for each different resource type used to pay for that event" (Jubilee's Coat 47004, and
   * her Sunglasses 47005 for an ATTACK event; docs/phase7-wave8.md §3.62). While the rule is in force, a payment its
   * speaker ("you") makes for a card `cards` matches is one whose wilds the player declares (`declareWildTypes`,
   * §4.1 Q33 = B), exactly as when the played card itself is marked `AbilityDefinition.readsPaidTypes`. The rule changes
   * nothing else: the reading is done by the card's own ability (`ValueSpec paidTypeCount` / `Predicate paidType` with
   * `of`).
   *
   * `reads`: what the card reads, for the one shortcut that skips the prompt (`PaidTypesRead`). Default: the count.
   * A constant like any other: off while its `while` is false, on the face that is not up, and under a blank text box.
   */
  | {
      readonly kind: "readsPaymentTypesOf";
      readonly cards: TargetQuery;
      readonly reads?: PaidTypesRead;
      readonly while?: Predicate;
    };

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
 * A threshold the cards picked for a `discardFromHand` cost must reach *together*: the sum of `measure` over every
 * pick is at least `atLeast`, and the player chooses which (and how many) matching cards make it up.
 *
 * `printedCost` is each card's printed resource cost (RRG 1.8 "Cost", p. 13: "A card's resource cost is the numerical
 * value that must be paid to play the card"), never the resources it would generate, and never a cost modified by
 * what it would cost to play right now. A card printed with an X cost counts as 0: X is only defined while that card
 * is being played (RRG 1.8 "Non-Numerical Variable", p. 30: an undefined X "is equal to 0"), and card data already
 * stores it as `cost: 0` with `specialCost: "X"`; a card with no printed cost at all (a resource) also adds 0.
 *
 * Paid in full or not at all (RRG 1.8 "Cost", p. 13): picks summing below `atLeast` are refused, so a hand whose
 * matching cards can't reach it can't initiate the ability and `legalActions` never offers it.
 */
export interface DiscardCombined {
  readonly measure: "printedCost";
  readonly atLeast: number;
}

/**
 * What an ability costs to initiate (RRG "Cost"). Every component is paid at
 * once when the ability is initiated; if any component can't be paid in full,
 * the ability can't be initiated. Cards the player picks as part of a cost are
 * named up front in the command's `costChoices` (keyed by the slot named here)
 * and are bound into the ability's effects under the same slot.
 */
/**
 * "Discard up to 3 cards from the top of your deck →" (docs/phase7-wave8.md §3.55): a deck discard cost of a size the
 * payer chooses (`AbilityCost.discardFromDeck`).
 *
 * - **The range.** From `min` to the smaller of `max` and the cards the deck can supply; `min` is at least 1 (RRG 1.8
 *   "Cost", p. 14: "up to" some number "requires a minimum of one"), so zero is never a payment: not paying is not
 *   using the ability. A deck that cannot supply `min` cannot pay (an empty deck with an empty discard pile), and the
 *   ability is not offered.
 * - **Chosen as the cost is paid**, in a `chooseNumber` choice (a range of one number is not asked), logged as
 *   `numberChosen`; then that many cards are discarded exactly as a fixed deck discard cost discards them, before the
 *   ability's effects (RRG 1.8 "Cost Arrow Icon", p. 14). A deck the cost empties resets at once.
 * - **The count** of cards discarded is var `cost.discardFromDeck` for the text after the arrow ("where X is the
 *   number of cards discarded this way"); `discardFromDeckSlot` binds the cards themselves as usual.
 */
export interface DeckDiscardChoice {
  readonly choose: { readonly min: number; readonly max: number };
}

/** "Take any amount of damage up to … →": the payer's choice of a `damageSelf` cost's amount (`AbilityCost.damageSelf`). */
export interface DamageSelfChoice {
  readonly choose: { readonly min: ValueSpec; readonly max: ValueSpec };
}

/**
 * "Spend up to 3 resources →" (docs/phase7-wave8.md §3.62): a resource cost whose size the payer chooses, from `min` to
 * `max` resources of any type.
 *
 * - **The payment is the choice.** The size is the number of resources the payment generates beyond anything else the
 *   same payment owes (a played card's own cost), so it is part of the command (`payment`) or of the logged answer to
 *   the pay prompt, and a replay makes the same one. `CostSelection.resources` may name it as well; it must then agree.
 * - **No overpayment.** The player sizes this cost, so every resource generated was spent on it: a payment that
 *   generates fewer than `min` or more than `max` is refused rather than capped, `overpaid.*` are 0 and `paid.count` is
 *   the whole payment. A card that generates two resources is two of the chosen size. This is the difference from
 *   `resourcesX` with `resource: "any"`, which caps X and lets the rest be overpaid (RRG 1.8 "Cost", p. 13).
 * - **At least one.** RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game elements
 *   requires a minimum of one such game element", so `min` is at least 1 and spending nothing is not triggering the
 *   ability.
 * - The size is recorded as var `cost.resources`. The types spent are read as any payment's are (`Predicate paidType`,
 *   `ValueSpec paidTypeCount`, on an ability marked `readsPaidTypes`), over the whole spent pool, each wild as its
 *   player declared it (§4.1 Q33 = B).
 *
 * Not with `resourcesX`, `resourcesEqualTo` or `sameResourceType`.
 */
export interface ResourcesChoice {
  readonly choose: { readonly min: number; readonly max: number };
}

/** Whether a cost's `resources` is a size the payer chooses (`ResourcesChoice`) rather than a fixed requirement. */
export const isResourcesChoice = (resources: AbilityCost["resources"]): resources is ResourcesChoice =>
  typeof resources === "object" && "choose" in resources;

/** The chosen-size range of a cost's `resources` (`ResourcesChoice`), or null when the cost has a fixed one or none. */
export const resourcesChoiceOf = (cost: AbilityCost | undefined): ResourcesChoice["choose"] | null =>
  isResourcesChoice(cost?.resources) ? cost.resources.choose : null;

/** The fixed part of a cost's `resources`: nothing when the payer chooses the size (`ResourcesChoice`). */
export const fixedResourcesOf = (cost: AbilityCost | undefined): number | ResourceRequirement | undefined =>
  isResourcesChoice(cost?.resources) ? undefined : cost?.resources;

export interface AbilityCost {
  /** "Exhaust [this card] →". */
  readonly exhaustSelf?: boolean;
  /**
   * "Flip [this card] →" (docs/phase7-wave7.md §3.64): the ability's own double-sided card (`flipSide`) turns to its
   * other face as the cost, keeping its state as any same-type flip does (RRG 1.8 "Flip", p. 20), and the flip is
   * announced (`cardFlipped`) above the frame being paid for. Payable only by a card in play with another face that
   * no `cannotFlip` rule names (RRG 1.8 "Cost", p. 13: paid in full or not at all). Not for a resource ability, whose
   * cost is paid in the middle of another payment.
   */
  readonly flipSelf?: boolean;
  /**
   * "Spend a [energy] resource" → `{ energy: 1 }`; "Spend [E][M][P]" → one of each. A number is a generic amount.
   * `{ choose }` is a number of resources of any type the payer chooses (`ResourcesChoice`).
   */
  readonly resources?: number | ResourceRequirement | ResourcesChoice;
  /**
   * "Spend X resources of any type, where X is the number of villains under Routed →": a number of resources of any
   * type the board gives, not the payer. Read when the cost is determined (RRG 1.8 "Initiating Abilities", p. 24, step
   * 3) with the ability's card as `self` and the payer as `you`, never below 0, added to any fixed `resources`, and
   * recorded as var `cost.resources`. An X of 0 is nothing to spend, so the rest of the cost alone pays it. Not to be
   * confused with `resourcesX`, where X is how much the payer chooses to spend.
   */
  readonly resourcesEqualTo?: ValueSpec;
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
   *
   * A `TargetRef` names any other card: "Remove 1 power counter from Phoenix Force →" (Psionic Bond, `phoenix` 34001a;
   * docs/phase7-wave6.md §3.85), read with the payer as `you` and the ability's card as `self`. It must name exactly
   * one card in play, holding enough counters, or the cost cannot be paid (RRG 1.8 "Cost", p. 13: paid in full or not
   * at all); a ref naming several cards is refused rather than one picked silently. The counters leave by the same
   * removal as any other (`counterRemoved`, so that card's "after the last counter is removed" responses answer it).
   */
  readonly spendCounters?: {
    readonly counterType: string;
    /** How many; with `upTo`, the most that may be removed. */
    readonly amount: number;
    readonly target?: "self" | "identity" | TargetRef;
    /**
     * "Remove **up to** 4 growth counters from Groot →" ("We Are Groot", `gmw` 16006; docs/phase7-wave3.md §3.32): the
     * player chooses how many, from 1 to `amount` (and no more than the card holds), in the command's
     * `costSelection.counters`. RRG 1.8 "Cost" (p. 14): "A cost requiring 'any number' or 'up to' some number of game
     * elements requires a minimum of one such game element", so 0 is not a payment. With no choice given, the most
     * that can be removed is.
     */
    readonly upTo?: boolean;
    /**
     * "Remove **each** [type] counter from [card] →" (Bishop, `gambit` 37011: "When Bishop attacks, remove each energy
     * counter from him → for each counter discarded this way, …"): every counter of the type on the holder, with no
     * choice; `amount` is ignored and the number removed is what `bind` reads. Not with `upTo`. It needs at least one
     * counter: RRG 1.8 "Cost" (p. 14) reads "A cost requiring 'any number' or 'up to' some number of game elements
     * requires a minimum of one such game element", and "each" is the same variable-quantity cost with the count
     * fixed by the board, so removing none is not a payment (by analogy; reported as a rules question).
     */
    readonly all?: boolean;
    /** The number of counters removed, bound to this var for the effects ("choose that many friendly characters"). */
    readonly bind?: string;
  };
  /**
   * "Place 1 charge counter on Gambit →" (Natural Agility, `gambit` 37008; docs/phase7-wave6.md §3.53): `amount`
   * counters of `counterType` are placed on the ability's own card (`target` absent or `"self"`) or on the paying
   * player's identity (`"identity"`) as the cost.
   *
   * - **Always payable.** Placing a counter needs nothing the player could lack, so this component never stops the
   *   ability being initiated (RRG 1.8 "Cost", p. 13, asks only that a cost be paid in full; nothing here can fall
   *   short).
   * - **Paid before the effects.** RRG 1.8 "Initiating Abilities" (p. 24): the cost is paid (step 5) before the
   *   effects resolve (step 6), so an effect counting those counters ("for each charge counter on Gambit") counts the
   *   one just placed.
   * - **Announced.** The placement is a `countersPlaced` event (`paidAsCost`), pushed above the ability's frame when an
   *   ability listens, so "after a counter is placed" responses resolve before the paid-for effects, as a counter
   *   cost's `countersRemoved` does.
   */
  readonly placeCounters?: {
    readonly counterType: string;
    readonly amount: number;
    readonly target?: "self" | "identity";
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
   *   pile"), and so does the engine (`settlePlayerDecks`, docs/phase7-wave3.md §4 Q15). An empty deck with cards in
   *   the discard pile only exists in a state built before that (a save, a test's surgery): it is reset first (with
   *   its facedown encounter card) and pays from the new deck. With both deck and
   *   discard pile empty there is nothing to discard, and the ability cannot be initiated.
   * - **A deck the cost empties resets immediately** (the same ruling), before the ability's effects resolve.
   * - **A value**: "When you would take any amount of damage from an attack, discard that many cards from the top of
   *   your deck →" (Shield Spell, `mts` 21061) is `{ kind: "eventAmount" }`, read against the event whose window the
   *   ability is being used in (the innermost open window), when the cost is checked and again when it is paid.
   *   docs/phase7-wave4.md §3.42.
   * - **A number the payer chooses**: "discard up to 3 cards from the top of your deck → … +X ATK …, where X is the
   *   number of cards discarded this way" (docs/phase7-wave8.md §3.55) is `{ choose: { min: 1, max: 3 } }`. See
   *   `DeckDiscardChoice`.
   */
  readonly discardFromDeck?: number | ValueSpec | DeckDiscardChoice;
  /**
   * "Discard the top 2 cards of your deck (top 3 cards instead if you are in alter-ego form) → add each SP//dr card
   * discarded this way to your hand" (Aunt May & Uncle Ben, `spdr` 31007): the cards `discardFromDeck` discarded are
   * bound to this slot of the ability's own frame, so its effects can name them (`cards(chosen(slot), filter)`). They
   * are only known once the cost is paid (the top of the deck is hidden), so, unlike `discardFromHand`'s picks, they
   * are added to the frame as the cost is paid rather than planned. A deck the cost empties is reset at once, so the
   * last discarded card may already be in the new deck by the time the effects read the slot; the slot still names it
   * (docs/phase7-wave3.md §4 Q18, the Teen Spirit precedent: "that card" names the specific card). Only with
   * `discardFromDeck`.
   */
  readonly discardFromDeckSlot?: string;
  /**
   * "Look at the top 2 cards of the encounter deck. Discard 1 of those cards → remove threat from a scheme equal to the
   * number of boost icons on that card" (Thief Extraordinaire, `gambit` 37001b; docs/phase7-wave6.md §3.54): as the
   * cost, the paying player looks at the top `look` cards of the active encounter deck and chooses `discard` of them,
   * which are discarded; the cards discarded are bound to `slot` on the frame being paid for, so the effects can read
   * them (`boostIcons` of that slot).
   *
   * - **Who looks.** Only the paying player (RRG 1.8 "Look, Looked-At", p. 27): the look is a `chooseCards` choice
   *   of theirs offering exactly the looked-at cards, which makes them face-visible for as long as it is open
   *   (`visibility.ts`), logged as `cardsLookedAt`. The cards not discarded never move: they stay on top in their
   *   order (p. 27: "returned to that deck in the same order").
   * - **From the top of the deck.** RRG 1.8 "Discard" (p. 16): "If a player looks at a number of cards from the top of
   *   a deck and discards one or more of those cards, those cards are considered to have been discarded from the top
   *   of that deck", so a discard that empties the deck resets it at that move (`settlePlayerDecks`, §3.60) and the
   *   discarded card is not in the new deck.
   * - **Fewer cards than `look`.** Looking does not empty the deck, so a deck of fewer cards shows what it has; an
   *   empty deck is reset first (RRG 1.8 "Encounter Deck", p. 17: "If the encounter deck is empty, the encounter
   *   discard pile is immediately shuffled"). The cost is payable only if the cards looked at can supply all
   *   `discard` (RRG 1.8 "Cost", p. 13: paid in full or not at all), so a deck and discard pile both empty, or a deck
   *   shorter than `discard`, cannot pay it, and `legalActions` does not offer the ability.
   * - **Paid before the effects.** The look and the discard are a step `payCost` pushes above the frame being paid
   *   for (the indirect-damage cost's pattern), so they resolve before its effects (RRG 1.8 "Initiating Abilities",
   *   p. 24, steps 5–6; "Cost Arrow Icon", p. 14), and a confused hero's labeled thwart still pays them (RRG 1.8
   *   "Labeled Ability", p. 26). Not for a resource ability, which is paid in the middle of another payment.
   */
  readonly encounterLookDiscard?: {
    readonly look: number;
    readonly discard: number;
    readonly slot: string;
  };
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
   * "Discard the top 2 cards of your deck (the top card instead if you control the Milano) →" (Reactor Core, `gmw`
   * 16165); "choose and discard 1 card from your hand (discard the top card of your deck instead if you control the
   * Milano) →" (Navigation Column, 16172). docs/phase7-wave3.md §3.49. A cost component the board picks, not the
   * player: `then` if `condition` holds, `else` otherwise, paid together with every other component of the cost.
   *
   * - **Decided when the cost is determined.** RRG 1.8 "Initiating Abilities" (p. 24), step 3: "Determine the cost (or
   *   costs) … taking modifiers into account". `condition` is read then, from the paying player's point of view (`you`
   *   is the payer, `self` the ability's card), and the branch is recorded as var `cost.condition` (1 for `then`, 0 for
   *   `else`).
   * - **No fallback.** "Instead" is a replacement (RRG 1.8 "Replacement Effect", p. 37): while the condition holds,
   *   the printed cost is no longer the cost at all. So only the selected branch is checked, and if it cannot be paid
   *   the ability cannot be initiated (p. 24, steps 3 and 5), even when the other branch could be. This is the
   *   difference from `either`, where the player picks among payable branches.
   * - A branch may contain `either` (a choice inside the board's pick) but not another `conditional`, and must not
   *   repeat a component of the rest of the cost.
   */
  readonly conditional?: {
    readonly condition: Predicate;
    readonly then: AbilityCost;
    readonly else: AbilityCost;
  };
  /**
   * "Deal yourself 1 facedown encounter card →" (Star-Lord; Daring Escape; Library Labyrinth; Universal Weapon): the
   * paying player is dealt that many encounter cards, facedown, as the cost (docs/phase7-wave3.md §3.20).
   */
  readonly dealEncounterCards?: number;
  /**
   * "Take 1 damage →" (Focused Rage): the controller's identity takes the damage. A value is read when the cost is
   * determined, with the cost's own picks bound: "choose an ATTACK event in your hand, and take damage equal to its
   * printed cost →" (Wolverine's Claws 35002) is `printedCost` of the `chooseCard` slot (docs/phase7-wave6.md §3.42),
   * recorded as var `cost.damageSelf`.
   *
   * `{ choose: { min, max } }` (docs/phase7-wave7.md §3.79): "Take any amount of damage up to your remaining hit
   * points →". The payer picks the amount as the cost is paid, in a `chooseNumber` choice, and the pick is recorded as
   * var `cost.damageSelf` for the text after the arrow ("deal an equal amount of damage"). The bounds are read when
   * the cost is determined (RRG 1.8 "Initiating Abilities", p. 24, step 3), `min` never below 0.
   *
   * - **0 is a legal pick when `min` is 0** (owner decision, docs/phase7-wave7.md §4.1 Q46 = B): no damage is dealt,
   *   the cost is paid and the effects resolve with 0.
   * - **Only amounts that can all be taken are offered** (RRG 1.8 "Cost", p. 14; FAQ "Focused Rage (#27)", p. 57): the
   *   range stops below the first amount the identity could not take in full, so an identity holding a tough status
   *   card, one that cannot take damage or one a constant reduces damage to is offered 0 alone when `min` is 0, and
   *   otherwise the cost cannot be paid. A range of one number is not asked.
   * - Damage past the identity's remaining hit points is still taken (`canTakeCostDamage`), so "up to your remaining
   *   hit points" is the card's `max`, not an engine cap.
   */
  readonly damageSelf?: number | ValueSpec | DamageSelfChoice;
  /** "Deal 2 damage to him →" (War Machine): this card takes the damage. */
  readonly damageThisCard?: number;
  /**
   * "Take 3 indirect damage →" (Kinetic Armor, `sm` 27149): the paying player takes that much indirect damage, divided
   * among the characters they control (RRG 1.8 "Indirect Damage", p. 24), before the ability's effects resolve.
   *
   * - **Payable only if it can all be taken.** RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not
   *   considered paid unless all of that damage was taken." So the ability is offered only while the payer's
   *   characters can absorb every point: each one's remaining hit points, none that cannot take damage from this
   *   card, and none holding a tough status card, which would prevent what it is assigned (the Focused Rage FAQ entry,
   *   RRG 1.8 p. 57: a cost that tough would prevent "cannot be paid", and "you cannot partially pay a cost"). For the
   *   same reason the assignment itself leaves out a character with a tough status card (`dealIndirectDamage.asCost`).
   * - **Not all taken, not paid.** Damage prevented as it is taken (a reduction the payability check cannot know of)
   *   means the cost was not paid, so the ability's effects do not resolve (`settleCostDamage`); the damage already
   *   taken stays taken, as in the thwart cost's §4.1 Q30.
   */
  readonly indirectDamage?: number;
  /**
   * "Give the villain a tough status card … →" (Neocarbon Scales, `sm` 27150): each card `to` names (read with the
   * payer as `you` and the ability's card as `self`) is given one status card of that type. Payable only if `to` names
   * at least one card in play and every one of them can hold another (RRG 1.8 "Status Cards", p. 41: "A character
   * cannot have more than one status card of each type at a time"; `statusCapacity` for steady and the rest), since a
   * cost is paid in full or not at all (RRG 1.8 "Cost", p. 13).
   */
  readonly giveStatus?: { readonly status: StatusName; readonly to: TargetRef };
  /**
   * "Discard a tough status card from your hero →" (Made of Rage, `mut_gen` 32007; Bulletproof Protector, 32009): one
   * status card of that type is discarded from each card `from` names (read with the payer as `you` and the ability's
   * card as `self`). Payable only if `from` names at least one card in play and every one of them holds one (RRG 1.8
   * "Cost", p. 13: paid in full or not at all); a card holding several (Colossus, §3.7) loses one. Each card discarded
   * is announced as `TriggerEvent statusDiscarded` with cause `cost`, and those responses resolve before the ability's
   * effects (RRG 1.8 "Cost Arrow Icon", p. 14). docs/phase7-wave6.md §3.6.
   */
  readonly discardStatus?: { readonly status: StatusName; readonly from: TargetRef };
  /**
   * "… and 1 facedown boost card →" (Neocarbon Scales, `sm` 27150): each card `to` names is dealt `count` facedown
   * boost cards from the encounter deck, which wait there until it activates (RRG 1.8 "Boost, Boost Icon", p. 11: "If
   * an enemy is dealt a boost card outside of its own activation, that boost card remains facedown on that enemy").
   * Payable only if `to` names at least one card in play and the encounter deck, with its discard pile reshuffled in
   * when it runs out ("Encounter Deck", p. 17), holds enough cards for all of them.
   */
  readonly giveBoostCards?: { readonly count: number; readonly to: TargetRef };
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
  /**
   * "Discard 1 identity-specific card at random from your hand →" (Induced Panic, `sm` 27153): the random pick is
   * among the hand cards matching this, read from the paying player's point of view (`identitySetOf: you`), and the
   * cost is payable only with enough matching cards left. Only with `discardRandomFromHand`.
   */
  readonly discardRandomFromHandFilter?: TargetQuery;
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
   *
   * `combined` adds a threshold over the picked cards together rather than a count: "Discard any number of attack
   * cards from your hand with a combined resource cost of 3 or more →" (Advanced Glider, `sm` 27136) is `{ min: 1,
   * filter: { trait: ATTACK }, combined: { measure: "printedCost", atLeast: 3 } }`. See `DiscardCombined`.
   */
  readonly discardFromHand?: {
    readonly min: number;
    readonly max?: number;
    readonly bind?: string;
    readonly filter?: TargetQuery;
    readonly combined?: DiscardCombined;
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
  /**
   * "Choose an ATTACK event in your hand … →" (Wolverine's Claws 35002; docs/phase7-wave6.md §3.42): a card picked in
   * `costChoices[slot]` and bound to `slot`, with nothing else done to it. It stays where it is; the ability's effects
   * name it (`playFromHand.card`). Exactly one card, from the paying player's own zone (RRG 1.8 "Cost", p. 13: a cost
   * not in play is paid from the payer's own out-of-play areas).
   *
   * `playableIgnoringCost`: the effects play the card "ignoring its resource cost", so only a card that could be played
   * that way now is a legal pick (`playIgnoringCostFault`). RRG 1.8 "Cost" (p. 13): "An ability's cost cannot be paid if
   * that ability's effect requires one or more targets and there is not at least one valid target"; the same reading
   * `payPrintedCostOf.entersPlay` makes, so the damage and the exhaust are never paid for a card that cannot be played.
   */
  readonly chooseCard?: { readonly slot: string; readonly from: CardZoneQuery; readonly playableIgnoringCost?: true };
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
   *
   * A list is several picks paid together, each into its own slot: "Exhaust an [Avenger] character and a [Guardian]
   * character →" (As One!, Problem Solvers; docs/phase7-wave4.md §3.17) is two picks of one card, and one card cannot
   * pay both (RRG 1.8 "Cost", p. 13).
   */
  readonly exhaustCards?: InPlayCostPick | readonly InPlayCostPick[];
  /**
   * "Ready your sidekick →" (docs/phase7-wave8.md §3.54): the picked cards in play ready as the cost. See
   * `InPlayCostPick` for the pick, and `ready-cards-cost.ts` for how it is paid.
   *
   * - **Exhausted cards only** (owner decision §4.1 Q29 = A): a cost that changes nothing cannot be paid, so a card
   *   that is already ready is no candidate, as a card already exhausted is none for `exhaustCards`; nor is one that
   *   "cannot ready" (RRG 1.8 "'Cannot'", p. 11). With no candidate the ability is not offered (RRG 1.8 "Initiating
   *   Abilities", p. 24, steps 3 and 5).
   * - **An additional cost to ready is part of this cost.** RRG 1.8 "Ready" (p. 36) lets a player decline an
   *   additional cost to ready a card, and then "the card does not ready"; a cost is paid in full or not at all
   *   (RRG 1.8 "Cost", p. 13). So the resources a `RuleSpec readyCost` asks of the payer for each picked card are
   *   added to this cost's resource requirement and paid in the same payment, or nothing is paid.
   * - **Not readied, not paid.** The ready resolves above the ability's frame before its effects ("Cost Arrow Icon",
   *   p. 14), as any ready does: a "would ready" replacement and "after you ready" responses apply. If a picked card
   *   is not ready afterward (a replacement took the ready), the cost is unpaid and the effects do not resolve.
   */
  readonly readyCards?: InPlayCostPick;
  /** "… return Captain America's Shield from play to your hand →": cards in play go to their owner's hand. See `InPlayCostPick`. */
  readonly returnToHand?: InPlayCostPick;
  /**
   * "Discard an upgrade you control →" (Lethal Weapon, `nebu` 22030); "Discard an ally you control →" (Noble Sacrifice,
   * `magneto` 49018); "Discard a [Tech] upgrade you control →" (Repurpose, `spdr` 31016); "Discard an ally or
   * [persona] support you control →" (Delusion of Collusion, `sm` 27170): cards in play discarded as part of the cost.
   * A candidate must be able to leave play. See `InPlayCostPick`; docs/phase7-wave4.md §3.25.
   */
  readonly discardCards?: InPlayCostPick;
  /**
   * "Deal 1 damage to a [Web-Warrior] character you control →" (Thwip Thwip!, `spdr` 31017; Quick Quip, `silk` 52034):
   * the picked character(s) each take `amount` damage from this card as the cost. See `InPlayCostPick` for the pick.
   *
   * - **Payable only if the pick can take it all.** RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is
   *   not considered paid unless all of that damage was taken." So a candidate is a character that could take every
   *   point right now (`canTakeCostDamage`): not one that cannot take damage from this card, one a "prevent all damage"
   *   constant covers, one a constant reduction would bring short, or one holding a tough status card (the Focused
   *   Rage FAQ entry, RRG 1.8 p. 57: a cost tough would prevent "cannot be paid"). With no candidate the ability is not
   *   offered (RRG 1.8 "Initiating Abilities", p. 24, steps 3 and 5).
   * - **Not all taken, not paid.** The damage resolves above the ability's frame before its effects ("Cost Arrow Icon",
   *   p. 14); prevented as it is taken (an interrupt the check could not know of), the cost is unpaid and the ability's
   *   effects do not resolve (`settleCostDamage`), as for `indirectDamage`.
   */
  readonly damageCards?: DamageCostPick;
  /**
   * "Find Touched and attach it to a character other than Rogue … →" (Energy Transfer, `rogue` 38007, erratum RRG 1.8
   * p. 69; docs/phase7-wave6.md §3.49): as the cost, a card is attached to a host the payer picks. See `AttachCost`.
   */
  readonly attach?: AttachCost;
  /**
   * "… and deal 2 damage to that character →" (Energy Transfer): `amount` damage from the ability's card to each card
   * `target` names (read with the cost's own picks bound, so `{ kind: "slot", slot: attach.to.slot }` is the host just
   * picked), as part of the cost. docs/phase7-wave6.md §3.49.
   *
   * - **Dealing, not taking.** RRG 1.8 "Cost" (p. 14): "If dealing damage is a cost, that cost is considered paid even
   *   if some or all of that damage is prevented." So nothing about the target's toughness, tough status card or
   *   "cannot take damage" is checked, and the effects resolve whatever is prevented (unlike `damageCards`, `damageSelf`
   *   and `indirectDamage`, which are damage the payer's characters *take*: "not considered paid unless all of that
   *   damage was taken").
   * - **Payable while it names a card in play.** With none, the cost cannot be paid (RRG 1.8 "Cost", p. 13).
   * - **Before the effects.** One `dealDamage` event per target, pushed above the frame being paid for (RRG 1.8 "Cost
   *   Arrow Icon", p. 14), after the rest of the cost is paid (so after an `attach` in the same cost).
   */
  readonly dealDamage?: { readonly target: TargetRef; readonly amount: number };
  /**
   * "Attached villain attacks you →" (docs/phase7-wave7.md §3.19 (b)): `enemy` (the first card the ref names) attacks
   * the paying player as the cost. See `enemy-attack-cost.ts`.
   *
   * - **Resolved in full before the effects.** The attack is a step `payCost` pushes above the frame being paid for:
   *   boost card, defender (any player may defend, as for any enemy attack), boost abilities, damage, then the "after
   *   [enemy] attacks" abilities, all before the text after the arrow (RRG 1.8 "Cost Arrow Icon", p. 14). It is paid
   *   after the rest of the cost, resources included.
   * - **Payable only while the enemy could attack** (owner decision, §4.1 Q13 = B): not while it is stunned (the attack
   *   would be replaced by discarding the stun; RRG 1.8 "Stun, Stunned", p. 41), cannot activate, has a dashed ATK or
   *   is not in play. The ability is then not offered and the stun is not spent.
   * - **Paid only by an attack that is made.** One an interrupt cancels was not made, so the ability's effects do not
   *   resolve (`settleEnemyAttackCost`); one another player defends was. Not for a resource ability, which is paid in
   *   the middle of another payment.
   */
  readonly enemyAttack?: { readonly enemy: TargetRef; readonly against: "you" };
  /**
   * "Resolve its 'Forced Response' as if it just attacked you →" (Golden Horse, `aoa` 45090; Metal Wings 45091;
   * docs/phase7-wave8.md §3.11): the printed abilities of kind `trigger` on `of` (the first card the ref names) resolve
   * as the cost, with the paying player as "you". See `resolve-ability-cost.ts` and `EffectSpec resolveSpecials`, whose
   * `abilities` and `asIf` these are.
   *
   * - **Resolved in full before the effects.** The abilities are steps `payCost` pushes above the frame being paid for
   *   (RRG 1.8 "Cost Arrow Icon", p. 14), after the rest of the cost.
   * - **Payable only while resolving them would change something** (owner decision §4.1 Q7 = A): not when the card has
   *   no live ability of the kind, and not when what it has would leave the game as it is (a discard with nothing to
   *   discard). The ability is then not offered. Judged by resolving them on a copy of the state
   *   (`resolvingWouldChange`), never by the abilities' shape.
   * - **Paid only by an ability that resolves.** With none resolved the cost is unpaid and the ability's effects do not
   *   resolve (`settleResolveAbilityCost`). Not for a resource ability, which is paid in the middle of another payment.
   * - **`trigger: "special"`**: "Resolve the 'Special' ability on the [SETTING] environment → discard this card"
   *   (docs/phase7-wave8.md §3.24). RRG 1.8 "Special" (p. 40) lets a Special resolve "through the explicit instruction
   *   of another card ability", which this cost is. With no card for `of` (no such environment in play) the cost
   *   cannot be paid and the ability is not offered (RRG 1.8 "Cost", p. 13).
   * - **`choose`**: `of` may name several cards ("the [SETTING] environment" with two in play, §4.1 Q15 = A: the
   *   resolving player chooses). The payer picks one in `costChoices[choose]`, as every cost pick is made up front, and
   *   it is bound to that slot for the effects. With exactly one card the pick is forced and may be omitted. A card
   *   whose abilities could change nothing is not a legal pick; the cost is payable while any one is. Absent: the first
   *   card `of` names.
   */
  readonly resolveAbility?: {
    readonly of: TargetRef;
    readonly choose?: string;
    readonly trigger: "forcedResponse" | "special";
    readonly abilities?: readonly AbilityId[];
    readonly asIf?: { readonly remainingHpAtLeast?: number };
  };
}

/**
 * Whether a printed ability is one `resolveSpecials` resolves for this `trigger` (`EffectSpec resolveSpecials`): a
 * "Forced Response" is a `response` trigger that is forced and a "Forced Interrupt" an `interrupt` trigger that is
 * forced; the others are named by their own trigger kind. A card's attach instruction is not one of its When Revealed
 * abilities (docs/phase7-wave7.md §3.35).
 */
export function resolvableAs(
  definition: AbilityDefinition | undefined,
  trigger: "special" | "whenRevealed" | "whenDefeated" | "forcedResponse" | "forcedInterrupt",
): boolean {
  if (!definition || definition.attachInstruction) return false;
  if (trigger === "forcedResponse") return definition.trigger.kind === "response" && definition.trigger.forced;
  if (trigger === "forcedInterrupt") return definition.trigger.kind === "interrupt" && definition.trigger.forced;
  return definition.trigger.kind === trigger;
}

/**
 * `AbilityCost.attach` (docs/phase7-wave6.md §3.49): "Find Touched and attach it to a character other than Rogue →".
 *
 * - **The card.** The first card `card` names that the payer may pay with, read with the payer as `you` and the
 *   ability's card as `self`: for a `TargetRef find` ("find Touched", §3.48), in a find's search order. RRG 1.8 "Cost" (p. 14): "that player
 *   must pay costs with cards and/or game elements they control", and "If a cost requires a game element that is not in
 *   play, the player paying the cost may only use game elements that are in their own out-of-play areas": a card in play
 *   the payer does not control, or out of play anywhere but the payer's own hand, deck, discard pile or set-aside area,
 *   cannot pay it. A find is logged `cardFound`, and each deck it searched is shuffled after the attach (RRG 1.8
 *   "Search", p. 39). With no card, the cost cannot be paid and the ability is not offered.
 * - **The host.** One card in play matching `to.query` (read with the card bound to `bind`, when given), picked by the
 *   payer in `costChoices[to.slot]` and bound to that slot for the rest of the cost and the effects; with exactly one
 *   candidate the pick is forced and may be omitted. Any card in play can be a candidate (an enemy, another player's
 *   identity or ally): the host is a target of the cost, not a card it is paid with. Not the card itself, not a host that
 *   cannot have it attached, and not a new host for a card that cannot be unattached (`canAttachTo`). The card's own
 *   "attach to" text is not read (RRG 1.8 "Attach To", p. 8: "not resolved if another ability causes that card to attach
 *   to a specific game element"). The card's current host is a legal pick: it stays there, as `findCard` leaves a card
 *   already at its destination (§3.48). With no candidate the cost cannot be paid and the ability is not offered.
 * - **Control.** Unchanged: a card attached from out of play enters under its owner's control, one moved between hosts
 *   keeps its controller (`resolve/attach.ts`). Its host leaving play discards it to its owner's discard pile (RRG 1.8
 *   "Attach To", p. 8).
 * - **Paid at once,** with the rest of the cost, before the ability's effects.
 */
export interface AttachCost {
  readonly card: TargetRef;
  readonly to: { readonly slot: string; readonly query: TargetQuery };
  /** The attached card, bound to this slot for the effects ("you gain each of the attached character's traits"). */
  readonly bind?: string;
}

/** `AbilityCost.damageCards`: an `InPlayCostPick` whose picks each take `amount` damage. */
export interface DamageCostPick extends InPlayCostPick {
  readonly amount: number;
}

/** How an `InPlayCostPick` spends its cards. */
export type InPlayCostMode = "exhaust" | "ready" | "return" | "discard" | "damage";

/**
 * Every `InPlayCostPick` a cost makes, in the order they are checked: the exhaust picks, the ready pick, the return
 * pick, the discard pick, the damage pick.
 */
export function inPlayPicksOf(
  cost: AbilityCost | undefined,
): readonly { readonly mode: InPlayCostMode; readonly pick: InPlayCostPick }[] {
  if (!cost) return [];
  const exhaust =
    cost.exhaustCards === undefined ? [] : "slot" in cost.exhaustCards ? [cost.exhaustCards] : cost.exhaustCards;
  return [
    ...exhaust.map((pick) => ({ mode: "exhaust" as const, pick })),
    ...(cost.readyCards ? [{ mode: "ready" as const, pick: cost.readyCards }] : []),
    ...(cost.returnToHand ? [{ mode: "return" as const, pick: cost.returnToHand }] : []),
    ...(cost.discardCards ? [{ mode: "discard" as const, pick: cost.discardCards }] : []),
    ...(cost.damageCards ? [{ mode: "damage" as const, pick: cost.damageCards }] : []),
  ];
}

/**
 * A cost paid with cards in play (`AbilityCost.exhaustCards` / `readyCards` / `returnToHand` / `discardCards` /
 * `damageCards`).
 *
 * - **Who pays.** Only cards in play that the paying player controls and that match `query` are candidates (RRG 1.8
 *   "Cost", p. 14: "that player must pay costs with cards and/or game elements they control"; ruling June 25, 2026
 *   #1: Steve Rogers can't pay Shield Toss with a Shield Falcon controls). An exhaust candidate must be ready, a
 *   ready candidate exhausted and able to ready. A return candidate must be able to leave play (RRG "Cannot", p. 11).
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
  /**
   * "Discard the highest-cost upgrade you control →" (Arm Cannon, `sm` 27147): only the cards matching `query` that the
   * payer controls and that tie for the highest (or lowest) `measure` among them can pay; a tie is the payer's pick. The
   * superlative is taken over every matching card before asking whether it can pay, so a highest-cost card that cannot
   * leave play leaves the cost unpayable rather than passing the cost to the next one down (the text names that card).
   */
  readonly superlative?: { readonly order: "highest" | "lowest"; readonly measure: DiscardCombined["measure"] };
  /**
   * "Exhaust your identity and **each** support you control →" (Family Matters, `mojo` 39061): the cost takes every
   * card in play the payer controls that matches `query`, with nothing to pick.
   *
   * - **All or nothing.** Payable only while every one of those cards can pay (each is ready, to exhaust it): RRG 1.8
   *   "Initiating Abilities" (p. 24, step 3, "Determine the cost … and the player's ability to pay them"; step 5, "If
   *   this step is reached and the cost(s) cannot be paid, abort this process without paying any costs") and "Cost
   *   Arrow Icon" (p. 14, the text before the arrow "must be paid and/or resolved in full"). One exhausted support
   *   leaves the ability unavailable; it is not paid with the rest.
   * - **Read when the cost is paid.** The set is whatever matches then, so a card that entered play since is in it and
   *   another player's cards never are (RRG 1.8 "Cost", p. 13: paid "with cards and/or game elements they control").
   * - **`min` is how many must match**, and may be 0: with no matching card that part of the cost asks for nothing and
   *   the rest of the cost pays alone (Family Matters with no support exhausts the identity). `max` is not read.
   * - A command's `costChoices[slot]`, if given, must name exactly that set. The cards are bound to `slot`, their
   *   count to `bind`.
   * - The query must not match a card another part of the same cost spends (the ability's own card under
   *   `exhaustSelf`, the identity under `exhaustIdentity`, another pick's card): one card cannot pay two parts of a
   *   cost (RRG 1.8 "Cost", p. 13), so that cost would never be payable.
   */
  readonly each?: true;
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
  /**
   * - `"triggeringEvent"`: "(Max 1 per event.)" / "(Max 1 per attack.)" / "(Max 1 per basic power use.)" (Web-Bracelet,
   *   Ghost Kick, Phantom Flip, `sm`; docs/phase7-wave5.md §3.14). RRG 1.8 "Max 1 per [instance]" (p. 28): "restricts
   *   the number of times an ability can be triggered by a single instance of a triggering effect across all copies of
   *   the card with the maximum". One count per triggering event instance (its event frame), shared by every card with
   *   the same title; `period` is not read, and the counts are dropped at every turn, phase and round boundary.
   *   On an event played from hand in a timing window (docs/phase7-wave7.md §3.69) a copy at the maximum is not
   *   offered, a second copy picked with the first is left in hand unpaid, and a copy whose effects are canceled
   *   still counts (RRG 1.8 "Max, Maximum", p. 28). The maximum is for all players, as that entry says.
   */
  readonly per?: "aspectOfEventCard" | "player" | "triggeringEvent";
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
  | { readonly kind: "topCardOfDiscard" }
  /**
   * "Generate the printed resource on your faceup energy form upgrade" (Energy Duplication, `mts` 21006): the printed
   * resources of the matching card(s) in play, read as they are when the resource is generated. docs/phase7-wave4.md
   * §3.38.
   */
  | { readonly kind: "printedResourcesOf"; readonly cards: TargetQuery }
  /**
   * "This card generates [wild] for each ally you control (to a maximum of 3)" (Band Together, `mts` 21018): one
   * `resource` per matching card in play, to `max`. docs/phase7-wave4.md §3.38.
   */
  | {
      readonly kind: "perCard";
      readonly resource: keyof ResourcePool;
      readonly per: TargetQuery;
      readonly max?: number;
    }
  /**
   * "Generate a [physical] resource for each tough status card on Colossus" (Titanium Muscles, `mut_gen` 32005;
   * docs/phase7-wave6.md §3.78): `amount` of `resource`, the value read as the resource is generated with "this card"
   * as the generating card and "you" as the player using it (to `max`, never below 0). `perCard` is the count of
   * cards in play matching a query; this is any number the table gives (a status-card count, counters, a stat).
   *
   * An amount of 0 generates nothing and the ability may still be used: RRG 1.8 "Resource Ability" (p. 37) lets it
   * trigger "anytime the player who controls the ability is generating resources to pay a cost", it names no target
   * whose absence would stop the cost being paid ("Cost", p. 13), and generating beyond or short of what a cost needs
   * is the player's to choose ("While paying a cost, a player is permitted to generate resources beyond the specified
   * cost"). Its cost is paid for nothing, as `perCard` with no matching card and `topCardOfDiscard` with an empty pile
   * already are.
   */
  | {
      readonly kind: "amount";
      readonly resource: keyof ResourcePool;
      readonly amount: ValueSpec;
      readonly max?: number;
    };

export interface AbilityDefinition {
  readonly trigger: AbilityTriggerSpec;
  /**
   * The ability "refers to the mission area" though its printed words do not name it card by card (MC45 p. 5: cards
   * there "cannot be affected by card abilities unless the ability refers to the mission area";
   * docs/phase7-wave8.md §3.33, §4.1 Q19 = B): every query, host reference and target ref of this ability may match
   * cards in the closed in-play scenario area of this name as well as cards outside it. Without it an ability reaches
   * such a card only through a query that names the area (`TargetQuery.inScenarioPlayArea`), and its own card. An
   * upgrade attached to an ally at the mission is an ordinary ability with no reach, so its "attached ally gets …"
   * finds no host there.
   */
  readonly reaches?: { readonly scenarioPlayArea: string };
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
  /**
   * `"hand"`: the ability works while its card is in its owner's hand, and only then — "While Pip the Troll is in your
   * hand, he gains 'Interrupt: When a player is attacked, spend [energy][mental] resources → put Pip the Troll into play
   * under that player's control.'" (Pip the Troll, `mts` 21032); "While this card is in your hand, it gains: 'Alter-Ego
   * Action: Spend a [mental] resource → remove this card from the game.'" (System Shock, 21185). Using it is not playing
   * the card: its owner pays the ability's own cost. docs/phase7-wave4.md §3.13.
   *
   * `"victoryDisplay"`: a constant ability that applies while its card is in the victory display, and only then ("While
   * this card is in the victory display, your identity gains the [X] trait and your hero gets +1 THW, +1 ATK and +1
   * DEF"; docs/phase7-wave7.md §3.50). RRG 1.8 "Victory Display" (p. 46): cards there "follow the standard rules for
   * out-of-play cards", and "In Play and Out of Play" (p. 23): an out-of-play card's ability affects the game only when
   * it "specifically refer[s] to being used from an out-of-play area". So the card's other abilities stay off there,
   * and this one is off in play and in every other area. Its modifiers, trait grants, keyword grants and the rules
   * `activeRules` reads are collected (`constantSources`, `constantAbilityRefs`); "you" is the card's owner
   * (`constantControllerOf`), and nothing is collected once that player is eliminated. Constants only: a triggered
   * ability or an action marked this way is never offered (the DSL's `validateDefinition` rejects one).
   *
   * `"discard"`: a response the card itself makes to its own discard from the top of its owner's deck, read from the
   * card where that discard left it ("Response: After this card is discarded from the top of your deck, add it to your
   * hand"; docs/phase7-wave7.md §3.55). The card "specifically refer[s] to being used from an out-of-play area" (RRG
   * 1.8 "In Play and Out of Play", p. 23), so this ability is on there and nowhere else: not in play, not in hand, and
   * not for a card that reached the discard pile any other way. Offered to the card's owner as its "you" (p. 31: "A
   * player controls the cards in their own out-of-play areas"), once per discard, in that discard's response window (`TriggerEvent cardDiscardedFromDeck`, `selfIs: "target"`), optional
   * unless printed Forced; it has no cost (nothing out of play pays one). Only such a response: the DSL's
   * `validateDefinition` rejects any other ability marked this way.
   */
  readonly activeIn?: "hand" | "victoryDisplay" | "discard";
  /**
   * "This effect cannot be canceled." on a "When Revealed" ability (the Cosmic Entities, `mts` 21042/21048/21054/21060:
   * "When Revealed: Deal 2 damage to the villain and remove this card from the game. This effect cannot be canceled.";
   * Longshot and Cornered!, `mojo` 39071, 39017): a cancel of the revealed card's effects or of its "When Revealed"
   * effects changes nothing (RRG 1.8 "Cancel" and "'Cannot'", p. 11). A card's own `RuleSpec cannotBeCanceled` does the
   * same while its `while` holds. docs/phase7-wave4.md §3.14.
   */
  readonly uncancellable?: true;
  /**
   * On a `whenRevealed` trigger: this ability is the card's attach instruction, not a printed When Revealed. "If
   * Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity." (Mental Transferal,
   * `next_evol` 40169) is "attach to" text whose host depends on a condition, so it cannot be an
   * `AttachmentCard.attachesTo` data host. It resolves at the reveal's attach step (RRG 1.8 "Reveal", p. 38, step 2),
   * where a data host would be applied and before the card's When Revealed abilities, and its effects attach the card
   * (`attach` with `self`); "you" is the revealing player. Canceling the card's "When Revealed" effects does not stop
   * it, canceling all the card's effects does (RRG 1.8 "Cancel", p. 13), and a card it leaves unattached is handled as
   * one with no legal data host is (RRG 1.8 "Attach To", p. 8). It is never resolved as a When Revealed: not by a
   * reveal's When Revealed step, a "resolve its 'When Revealed' ability" effect or a repeat. An attachment has at most
   * one, and no `attachesTo`. docs/phase7-wave7.md §3.35.
   */
  readonly attachInstruction?: true;
  /**
   * This ability reads the resource types that paid for its card (docs/phase7-wave8.md §3.62): "X is the number of
   * different resource types … used to pay for this event" (`{ count: true }`), "If you paid for this card using 2
   * different resource types" (`{ atLeast: 2 }`), "If you paid for this event using at least 1: [physical] … [mental] …
   * [energy] …" (`{ types: ["physical", "mental", "energy"] }`).
   *
   * It marks the payment as one whose wilds the player declares (RRG 1.8 "Wild Resource", p. 48; ruling January 17, 2026
   * - Ruling 4 (1); §4.1 Q33 = B): the play command's `wildAs`, or the `declareWildTypes` choice. The engine never
   * chooses a declaration for the player. It skips the question only when every legal declaration gives every reader
   * of the payment the same reading, which is what this value is compared for. The reading itself is `ValueSpec
   * paidTypeCount` / `Predicate paidType` in the effects. A payment for a card that is not marked, and that no
   * `RuleSpec readsPaymentTypesOf` in force names, asks nothing and records no types.
   */
  readonly readsPaidTypes?: PaidTypesRead;
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
