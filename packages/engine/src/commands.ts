import type { AbilityId } from "@mc/content";
import type { ChoiceId, InstanceId, PlayerId } from "./ids.js";
import type { ResourceType } from "./resources.js";

/**
 * One source of resources toward a cost: a card discarded from hand, or a
 * "Resource" ability triggered while paying (RRG "Cost", "Resource Ability").
 *
 * `fromHand` also names a card tucked under a card whose rule lets the paying player spend it "as if it were in their
 * hand" (`RuleSpec spendableFromTucked`, Resource Reserve; docs/phase7-wave9.md §3.46 (c)): it is spent as a hand card
 * is, from under its host.
 *
 * A resource ability whose own cost picks cards ("Exhaust an [Interface] upgrade you control → generate that
 * upgrade's resources", SP//dr Suit's Sync Ratio) names its picks in `costChoices`, keyed by slot as for a command's
 * `CostChoices`. Absent, the pick pays itself only when it is forced (`InPlayCostPick`).
 *
 * A resource ability whose own cost leaves an amount to the player ("remove up to 2 threat from … → generate a
 * resource for each threat you removed this way") names it in `costSelection`, so what the use generates is known
 * when the payment is priced. Absent, it removes as much as it can.
 */
export type Payment =
  | {
      readonly fromHand: InstanceId;
      /**
       * The card's own "Interrupt: When you spend this card, [cost] → generate …" used with this spending (a resource
       * trigger with `whenSpent`): what it generates joins the payment with the card's resources. Absent, the card is
       * spent without it. One card is spent once, so a payment holds one entry for it, with or without this.
       */
      readonly whenSpent?: SpentCardAbilityUse;
    }
  | { readonly ability: ResourceAbilityUse };

/** The `whenSpent` ability a payment uses as it spends its card from hand (see `Payment`). */
export interface SpentCardAbilityUse {
  readonly abilityId: AbilityId;
  /** The cards the ability's own cost picks, by slot (as `ResourceAbilityUse.costChoices`). */
  readonly costChoices?: CostChoices;
  /**
   * The amounts the ability's own cost leaves to the player (as `ResourceAbilityUse.costSelection`): "When you spend
   * this card, take up to 3 damage → this card generates 1 additional [energy] resource for each damage taken this
   * way" names the damage in `damageSelf` (docs/phase7-wave10-hero-packs.md H3.14).
   */
  readonly costSelection?: CostSelection;
}

/** One use of a resource ability in a payment (see `Payment`). */
export interface ResourceAbilityUse {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  /** The cards the ability's own cost picks, by slot; absent when the pick is forced or the cost picks nothing. */
  readonly costChoices?: CostChoices;
  /**
   * The amounts the ability's own cost leaves to the player (`CostSelection.removeThreat`; docs/phase7-wave9.md
   * §3.7 (b); `CostSelection.damageSelf`, docs/phase7-wave10-hero-packs.md H3.14). A use in a payment is never asked
   * as its cost is paid, so the amount is part of the payment: absent, a chosen-amount threat cost removes the most
   * it can and a chosen-amount damage cost takes the least it may.
   */
  readonly costSelection?: CostSelection;
}

/**
 * Cards picked as part of a non-resource cost, keyed by the slot the cost
 * names (`discard` for "choose and discard N cards", the `payPrintedCostOf`
 * slot for "pay the printed cost of an ally in a discard pile"). Costs are
 * paid when the ability is initiated, so every choice is made up front.
 */
export type CostChoices = Readonly<Record<string, readonly InstanceId[]>>;

/**
 * The non-card decisions a cost leaves to the player, made up front like `CostChoices` (docs/phase7-wave3.md §3.32,
 * §3.36). Absent fields take the engine's default, so a command without this is exactly what it was before.
 */
export interface CostSelection {
  /** Which branch of an either/or cost (`AbilityCost.either`), 0-based. Default: the first branch that can be paid. */
  readonly branch?: number;
  /** How many counters an "up to N" counter cost removes (`spendCounters.upTo`). Default: as many as it can. */
  readonly counters?: number;
  /**
   * How many resources a chosen-size resource cost spends (`AbilityCost.resources { choose }`; docs/phase7-wave8.md
   * §3.62). This names the size beside the payment: the payment must generate at least that many, and anything more
   * is overpaid (owner decision, 2026-10-08, §4.1 row 78; RRG 1.8 "Cost", p. 13). Absent: the size is whatever the
   * payment generates, up to the cost's maximum.
   */
  readonly resources?: number;
  /**
   * How much threat a chosen-amount threat cost removes (`AbilityCost.removeThreat { choose }`; docs/phase7-wave9.md
   * §3.7 (b)): a whole number in the cost's range, from its `min` to the smaller of its `max` and the threat on the
   * card; anything else is refused. Named, the cost is paid with that amount and no `chooseNumber` choice is asked.
   * Absent: the payer is asked as the cost is paid, except for a resource ability used in a payment
   * (`ResourceAbilityUse.costSelection`), which removes the most it can. A fixed-amount threat cost ignores it.
   */
  readonly removeThreat?: number;
  /**
   * How much damage a chosen-amount damage cost takes (`AbilityCost.damageSelf { choose }`, "take any amount of damage
   * up to … →"; docs/phase7-wave7.md §3.79, docs/phase7-wave10-hero-packs.md H3.14): a whole number in the range the
   * cost offers right now, from its `min` to the most the identity could take in full; anything else is refused.
   * Named, the cost is paid with that amount and no `chooseNumber` choice is asked. Absent: the payer is asked as the
   * cost is paid, except for a resource ability used in a payment (`ResourceAbilityUse.costSelection`,
   * `SpentCardAbilityUse.costSelection`), which takes the least the cost allows: a payment is priced before it is
   * paid, and damage nobody named is not taken for the player. A fixed-amount damage cost ignores it.
   */
  readonly damageSelf?: number;
  /**
   * The number a chosen-size encounter deck discard cost discards (`AbilityCost.discardFromEncounterDeck { choose }`;
   * docs/phase7-wave9.md §3.43 (a)): a whole number from the cost's `min` to its `max`; anything else is refused. It
   * may be more than the deck holds (RRG 1.8 "Encounter Deck", p. 17). Named, no `chooseNumber` choice is asked.
   * Absent: the payer is asked as the cost is paid. A fixed-amount cost ignores it.
   */
  readonly discardFromEncounterDeck?: number;
  /**
   * Another player paying a part of this cost in the user's place (`RuleSpec costsPayableByAnyPlayer`, "While paying
   * costs on attached card, any player may help pay those costs"; docs/phase7-wave10-hero-packs.md H3.19, owner answer
   * 21B), or of the costs of an alliance card being played (RRG 1.8 "Alliance", p. 6; owner answer 48B): the player
   * who pays each part named, whole. A part left out, or given the user's own id, is paid by the user. Refused unless
   * such a rule names the card the cost is printed on or that card is an alliance card being played
   * (`costPartsPayableByAnyPlayer`), the player is still in the game and the
   * cost holds that part; then everything the part asks is checked against, and taken from, that player (their
   * identity takes the damage, their deck or hand is discarded from).
   *
   * Only the parts a cost words as "you" without naming a card are listed (`DelegableCostPart`). A part paid with a
   * card needs no entry: resources (`payment`), a discard from hand and a card in play (`costChoices`) name the cards,
   * and a helper's card is a helper paying. A part that names the user's own card ("exhaust your hero", "exhaust this
   * card") stays with the user and has no entry.
   */
  readonly paidBy?: CostPartPayers;
}

/**
 * The parts of a cost `CostSelection.paidBy` may hand to another player, named as their `AbilityCost` fields: "take N
 * damage" (`damageSelf`), "take N indirect damage" (`indirectDamage`), "discard the top N cards of your deck"
 * (`discardFromDeck`), "discard N cards at random from your hand" (`discardRandomFromHand`) and "deal yourself N
 * encounter cards" (`dealEncounterCards`).
 */
export const DELEGABLE_COST_PARTS = [
  "damageSelf",
  "indirectDamage",
  "discardFromDeck",
  "discardRandomFromHand",
  "dealEncounterCards",
] as const;
export type DelegableCostPart = (typeof DELEGABLE_COST_PARTS)[number];

/** Who pays which delegable part of a cost (`CostSelection.paidBy`). */
export type CostPartPayers = Readonly<Partial<Record<DelegableCostPart, PlayerId>>>;

/**
 * Every command names the player issuing it so authority can be checked here
 * rather than in a client (and so the netcode layer has one thing to validate).
 */
/** One target's share of a divided basic power (docs/phase7-wave2.md §3.7). */
export interface BasicPowerShare {
  readonly targetInstanceId: InstanceId;
  readonly amount: number;
}

export type Command =
  /**
   * RRG "Form, Change Form". `to` names the form, needed only for a three-sided identity (docs/phase7-wave2.md §3.2):
   * `{ heroForm: n }` is the hero face `IdentityState.heroFormIndex` n. Absent: the other form of a two-faced identity.
   *
   * `payment` and `costChoices` pay an additional cost to change form (`RuleSpec formChangeCost`,
   * docs/phase7-wave8.md §3.63), as a play's or an ability's pay its cost. With no such cost in force a payment is
   * refused: a free change spends nothing.
   */
  | {
      readonly type: "changeForm";
      readonly playerId: PlayerId;
      readonly to?: "alterEgo" | { readonly heroForm: number };
      readonly payment?: readonly Payment[];
      readonly costChoices?: CostChoices;
    }
  | {
      readonly type: "playCard";
      readonly playerId: PlayerId;
      readonly cardInstanceId: InstanceId;
      readonly payment: readonly Payment[];
      /** Required for upgrades that attach to something other than your identity; ignored otherwise. */
      readonly attachToInstanceId: InstanceId | null;
      readonly costChoices?: CostChoices;
      /** "Play under any player's control": who will control the card (defaults to the player). */
      readonly controllerId?: PlayerId;
      /**
       * The play's destination when it is not the player's own play area: an in-play scenario area a `playDestination`
       * rule in effect lets this card be played into ("either play that ally into their game area …, or play it into
       * the mission area", MC45 p. 5; docs/phase7-wave8.md §3.34). Part of the play, chosen with it: everything else
       * about the play is checked and paid as without it. Absent: the player's own area, as always.
       */
      readonly into?: { readonly scenarioPlayArea: string };
      /**
       * The value chosen for a cost printed "X" (`specialCost: "X"`; Speed Cyclone, docs/phase7-wave2.md §3.8). RRG 1.8
       * "Non-Numerical Variable" (p. 30): "the value of X is defined by card ability or player choice, after which the
       * amount paid may be modified by effects without changing the value of X". Bound as the play's var `x`. Absent is 0.
       */
      readonly x?: number;
      /**
       * `playCostReduction` abilities the player uses on this play ("When you play a card from your hand, deal yourself
       * 1 facedown encounter card → reduce the cost to play that card by 3", Star-Lord): each is validated, its cost paid
       * and its limit counted with the play, and the card costs that much less (docs/phase7-wave3.md §3.20).
       */
      readonly costReductionAbilities?: readonly {
        readonly instanceId: InstanceId;
        readonly abilityId: AbilityId;
      }[];
      /** The branch / counter count of the played event's action cost (`CostSelection`). */
      readonly costSelection?: CostSelection;
      /**
       * Which of an event's Action abilities this play triggers (RRG 1.8 "Event", p. 18: "If an event has more than
       * one triggered ability on it, the player playing it chooses one of those abilities to trigger when playing that
       * event"). Needed only when more than one could be triggered now; absent, the only usable one is triggered. Its
       * form, condition, targets and cost are the ones checked and paid, and it alone resolves. The choice is part of
       * the command because it comes before the cost is determined (RRG 1.8 "Initiating Abilities", p. 24, steps 2–3),
       * and the command carries the payment.
       */
      readonly abilityId?: AbilityId;
      /**
       * The type each wild resource of this payment is used as, one entry per wild in the order the payment generates
       * them; `"wild"` leaves it a wild (RRG 1.8 "Wild Resource", p. 48: "When a player generates a wild resource, they
       * may specify which resource type (energy, mental, physical, or wild) it is being used as"; ruling January 17,
       * 2026 - Ruling 4 (1); docs/phase7-wave8.md §3.62, §4.1 Q33 = B). Read only by a card that reads the types that
       * paid for it. Absent, the engine asks (`ChoicePrompt declareWildTypes`) when the declaration can change what
       * such a card reads, and never otherwise. Present, it must be legal (`wildDeclarationFault`) whatever reads it:
       * the wrong number of entries, or a declaration under which the payment no longer pays the cost, is refused.
       */
      readonly wildAs?: readonly ResourceType[];
    }
  | {
      readonly type: "useAbility";
      readonly playerId: PlayerId;
      readonly cardInstanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly payment: readonly Payment[];
      readonly costChoices?: CostChoices;
      /** Which branch of an either/or cost, how many counters an "up to N" cost removes (`CostSelection`). */
      readonly costSelection?: CostSelection;
      /**
       * The type each wild resource of this payment is used as, exactly as `playCard.wildAs` (docs/phase7-wave8.md
       * §3.62, §4.1 Q33 = B). Read only by an ability marked `readsPaidTypes` ("spend up to 3 resources → if you spent
       * at least 1 [energy] …"). Absent, the ability's frame asks (`declareWildTypes`) when the declaration can change
       * what the ability reads, and never otherwise. Present, it must be legal whatever reads it.
       */
      readonly wildAs?: readonly ResourceType[];
    }
  | {
      readonly type: "basicAttack";
      readonly playerId: PlayerId;
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      /** For a basic power with an additional cost ("you must discard 1 card"; `basicPowerCosts`). */
      readonly payment?: readonly Payment[];
      readonly costChoices?: CostChoices;
      /**
       * A divided basic attack (`RuleSpec divideBasicPower`; Wasp's Giant form, docs/phase7-wave2.md §3.7): the damage
       * split among several enemies, in the order the attacks resolve. The shares total the attacker's ATK; the first
       * share's target must be `targetInstanceId`.
       */
      readonly divide?: readonly BasicPowerShare[];
    }
  | {
      readonly type: "basicThwart";
      readonly playerId: PlayerId;
      readonly thwarterInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly payment?: readonly Payment[];
      readonly costChoices?: CostChoices;
      /**
       * A divided basic thwart, as `basicAttack.divide`: the first share is `schemeInstanceId`, and the shares total the
       * thwarter's THW, or its ATK when any of the schemes has assault (docs/phase7-wave7.md §4.1 Q3).
       */
      readonly divide?: readonly BasicPowerShare[];
      /**
       * Thwart with ATK instead of THW where a rule lets the player choose ("When a character thwarts this side scheme,
       * they may use their ATK instead of their THW", The Red House; `RuleSpec thwartWithAtk`). The Assault keyword
       * needs no flag: it always uses ATK (RRG 1.8 "Assault", p. 8).
       */
      readonly useAtk?: boolean;
    }
  | { readonly type: "basicRecover"; readonly playerId: PlayerId }
  | { readonly type: "endTurn"; readonly playerId: PlayerId }
  /**
   * Give up the game, for the whole table. **Not an RRG rule** — the RRG has no concede rule at all, so this is a
   * digital-implementation affordance and its shape is our decision, written down here rather than implied:
   *
   * - It is a *command*, not a client-side flag, because a `GameLog` is `{ initialState, commands }` and `replay()` is
   *   the only definition of what a saved game was. A client-only "abandoned" marker would replay to a live,
   *   unfinished game while the save claimed it was over.
   * - **Any seated, non-eliminated player may concede, and it ends the game for the whole table**, because a co-op
   *   table shares one outcome. If a future build wants every seat to confirm first, that is a client/netcode wrapper
   *   that gathers confirmations and then issues this one command — not engine behavior.
   */
  | { readonly type: "concede"; readonly playerId: PlayerId }
  | {
      readonly type: "resolveChoice";
      readonly playerId: PlayerId;
      readonly choiceId: ChoiceId;
      readonly selectedOptionIds: readonly string[];
    };

export type CommandType = Command["type"];
