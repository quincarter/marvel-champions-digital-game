import type { AbilityId, CardId } from "@mc/content";
import type { InPlayCostMode } from "./abilities.js";
import type { ChoiceId, FrameId, InstanceId, PlayerId } from "./ids.js";
import type { ReportedFact, ReportedFactAnswer } from "./outside-facts.js";
import type { ResourcePool, ResourceRequirement, ResourceType, TypedResource } from "./resources.js";
import type { PairLimit, StatusName } from "./spec.js";
import type { Form, ZoneId } from "./state.js";
import type { WindowTiming } from "./stack.js";
import type { TriggerEvent } from "./trigger-events.js";

/**
 * An enemy attack in progress. Kept for clients that render the defend prompt;
 * the authoritative copy of the attack lives in the `enemyAttack` stack frame.
 */
export interface AttackInProgress {
  readonly enemyInstanceId: InstanceId;
  readonly targetPlayerId: PlayerId;
  readonly targetCharacterInstanceId: InstanceId;
}

/** A place a card holds: its zone and its index there (0 is the top of a deck, the front of a dealt queue). */
export interface CardPosition {
  readonly zone: ZoneId;
  readonly index: number;
}

/** What a `chooseFromList` prompt enumerates. `cardType`: the fifteen card types (RRG 1.8 "Card Types", p. 12). */
export type ChoiceList = "cardType";

export type ChoicePrompt =
  | { readonly kind: "declareDefender"; readonly attack: AttackInProgress }
  | { readonly kind: "discardDownToHandSize"; readonly handSize: number }
  /** RRG Appendix II step 15. */
  /**
   * `additional`: the number of this mulligan past the first (1 for the first additional mulligan; docs/phase7-wave5.md
   * §3.26). Absent on a player's first mulligan.
   */
  | { readonly kind: "mulligan"; readonly handSize: number; readonly additional?: number }
  /** RRG "Activation": the engaged player chooses which of their minions activates next. */
  | { readonly kind: "chooseMinionToActivate" }
  /**
   * "Each Masters of Evil minion attacks …": one effect makes several enemies
   * attack or scheme, one at a time; the first player orders them (RRG "First Player").
   */
  | { readonly kind: "orderEnemies"; readonly activation: "attack" | "scheme" }
  /** RRG "Simultaneous Resolution": the first player orders same-trigger effects. */
  | { readonly kind: "orderTriggers"; readonly event: TriggerEvent; readonly timing: WindowTiming }
  /**
   * RRG 1.8 "Each Player" (p. 17): "If the effect does not specify what order the players resolve the effect in,
   * the first player decides the order." Ordering which players receive dealt encounter cards (ruling, Jan 26, 2026
   * (4) answer 3). The selections are player ids, in the order they resolve.
   */
  | { readonly kind: "orderPlayers"; readonly reason: "dealEncounterCards" }
  /**
   * "Put the others back in any order" (Heimdall): the selections are the cards, in the order they go back on top of
   * the deck. RRG 1.8 "Deck" (p. 15): a deck's order changes only when a card instructs it.
   *
   * `to: "encounterDeckBottom"` (docs/phase7-wave3.md §3.48): the cards going to the bottom of the encounter deck. Both
   * piles read the way the deck will: the first card selected is the highest of its pile, so the last card selected
   * for the bottom becomes the deck's bottom card.
   */
  | { readonly kind: "orderCards"; readonly to: "encounterDeckTop" | "encounterDeckBottom" }
  /** The same two piles going back into `deckOwner`'s player deck (docs/phase7-wave5.md §4.1 Q60). */
  | { readonly kind: "orderCards"; readonly to: "playerDeckTop" | "playerDeckBottom"; readonly deckOwner: PlayerId }
  /**
   * "Place the rest on the top and/or bottom of the encounter deck" (docs/phase7-wave3.md §3.48): select the cards that
   * go to the bottom; every card not selected goes on top. Any number may be selected, none included. Each pile of two
   * or more cards is then ordered (`orderCards`).
   */
  | { readonly kind: "chooseBottomCards"; readonly deck: "encounterDeck" }
  /** The same split for cards going back into `deckOwner`'s player deck (docs/phase7-wave5.md §4.1 Q60). */
  | { readonly kind: "chooseBottomCards"; readonly deck: "playerDeck"; readonly deckOwner: PlayerId }
  /** Optional interrupts/responses: a controller picks which of theirs to use, in order. */
  | { readonly kind: "chooseTriggers"; readonly event: TriggerEvent; readonly timing: WindowTiming }
  | { readonly kind: "chooseTarget"; readonly slot: string; readonly abilityId: AbilityId | null }
  | { readonly kind: "chooseAttachmentTarget"; readonly instanceId: InstanceId }
  /**
   * Cards outside play (a look at the top of a deck, a search, a discard pile), or any cards a ref names.
   *
   * `maxTotal` (`EffectSpec chooseCards.maxTotal`, docs/phase7-wave9.md §3.11): the selected cards' `values` (by
   * option id; `of` says what they are) sum to at most `atMost`. Every offered card fits on its own, and
   * `maxSelections` is the most that fit together; a selection over the limit is refused (`cardTotalFault`).
   */
  | {
      readonly kind: "chooseCards";
      readonly slot: string;
      readonly maxTotal?: {
        readonly of: "printedCost";
        readonly atMost: number;
        readonly values: Readonly<Record<string, number>>;
      };
    }
  /**
   * `EffectSpec lookAt`: the options are cards the player is looking at (RRG 1.8 "Look, Looked-At", p. 27), offered
   * only so they are face-visible to them. Nothing can be selected (`minSelections` = `maxSelections` = 0): the only
   * answer is the empty one, an acknowledge.
   */
  | { readonly kind: "lookAt" }
  /**
   * `EffectSpec lookAt` with `rearrange` (docs/phase7-wave9.md §3.12): "look at each encounter card dealt to each
   * player and the top card of the encounter deck. You may swap any number of those cards." The options are the cards
   * the player is looking at, face-visible to them alone (`visibility.ts`), and option `i` is the card now at
   * `positions[i]`. The answer is every option exactly once, in order (`minSelections` = `maxSelections` = the number
   * of options): selection `i` is the card that goes to `positions[i]`. The options in the order offered is the
   * arrangement that swaps nothing, which is always allowed.
   */
  | { readonly kind: "rearrange"; readonly positions: readonly CardPosition[] }
  /**
   * "Choose one" among labeled options; option ids are the option indexes. Also where a card an effect plays goes
   * when the rules give a choice of place (`EffectSpec playFromHand`): its option ids are `PLAY_TO_OWN_AREA` and
   * `playToAreaOption(area)`, each option's `ref` is the card being played, and its label says the place in words.
   */
  | { readonly kind: "chooseOption" }
  | { readonly kind: "choosePlayer"; readonly slot: string }
  /**
   * `EffectSpec basicPowerBy` (docs/phase7-wave8.md §3.64): a card's effect has `playerId` make a basic attack or
   * thwart, and this asks with which character and which power. One option per legal pairing, its `optionId`
   * `attack:<instanceId>` or `thwart:<instanceId>`, its `ref` the character and its label the power; a character
   * that could do either has two options. Exactly one is selected. `powers` is what the card allows;
   * `sourceInstanceId` the card instructing it.
   */
  | {
      readonly kind: "chooseBasicPower";
      readonly powers: readonly ("attack" | "thwart")[];
      readonly sourceInstanceId: InstanceId | null;
    }
  /**
   * The target of the basic power just chosen (`chooseBasicPower`): the enemies `characterInstanceId` may attack, or
   * the schemes it may thwart. An option's `optionId` is the target's instance id; a scheme the character may thwart
   * with ATK instead of THW (`RuleSpec thwartWithAtk`) has a second option, `<instanceId>#atk`. Exactly one is
   * selected.
   *
   * `mayDivide` (owner decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 82): the character may divide this basic
   * power (`RuleSpec divideBasicPower`), so one target or several may be selected (`maxSelections` says how many).
   * Several are a division, attacked or thwarted in the order selected, and a `divide` choice with `eachAtLeast: 1`
   * follows for the shares; an `#atk` option cannot be one of several.
   */
  | {
      readonly kind: "chooseBasicPowerTarget";
      readonly power: "attack" | "thwart";
      readonly characterInstanceId: InstanceId;
      readonly mayDivide?: true;
    }
  /** Order the Special abilities of a sequence (Wakanda Forever!). */
  | { readonly kind: "orderSpecials" }
  /**
   * A cost paid with cards in play whose cards are the player's choice, asked inside a timing window before the
   * payment (`InPlayCostPick`; docs/phase7-wave4.md §3.17): "exhaust an [Avenger] character and a [Guardian] character"
   * asks once per slot. Options are the candidates; selecting fewer than `min` backs out of the card or ability.
   *
   * Mode `discardFromHand` (slot `discard`): the cards in hand a "discard N cards from your hand →" cost
   * (`AbilityCost.discardFromHand`) of an interrupt or response is paid with, asked the same way; its options are
   * cards in hand, and a card picked is left out of the payment options that follow.
   */
  | {
      readonly kind: "chooseCostCards";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly slot: string;
      readonly mode: InPlayCostMode | "discardFromHand";
    }
  /**
   * An "up to N" counter cost of an interrupt or response the player chose to use inside a timing window ("remove up
   * to 3 charge counters from here →", Throw de Card, `gambit` 37001a; docs/phase7-wave6.md §3.53): how many to
   * remove, asked before the payment as an action's `costSelection.counters` is chosen up front (RRG 1.8 "Initiating
   * Abilities", p. 24, step 3). One option per count from `max` down to `min`, its `optionId` the number; exactly one
   * is selected. `min` is 1: RRG 1.8 "Cost" (p. 14), "a cost requiring … 'up to' some number of game elements requires
   * a minimum of one". `max` is the printed N or the counters the card holds, whichever is lower.
   */
  | {
      readonly kind: "chooseCostCounters";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly counterType: string;
      readonly min: number;
      readonly max: number;
    }
  /**
   * "Remove 1 all-purpose counter from [a card]" / "move 1 all-purpose counter" (`counterType: "any"`,
   * docs/phase7-wave9.md §3.6) from a card that holds counters of several types, with fewer taken than it holds: the
   * player resolving the effect picks which. RRG 1.8 "All-Purpose Counter" (p. 6): such an ability "can refer to any
   * all-purpose counter, regardless of what other types that counter might have". One option per counter that could
   * go (at most `amount` of a type), its `optionId` `<type>#<n>` and its label the type; exactly `amount` are
   * selected. `byType` is what the card holds. Not asked when the card holds one type or every counter goes.
   */
  | {
      readonly kind: "chooseCounters";
      readonly instanceId: InstanceId;
      readonly amount: number;
      readonly reason: "remove" | "move";
      readonly byType: Readonly<Record<string, number>>;
    }
  /** Paying for an interrupt/response event played from hand inside a timing window. */
  | {
      readonly kind: "payForCard";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly cost: number;
    }
  /**
   * An optional in-play interrupt/response whose cost includes resources
   * (Black Widow: "exhaust Black Widow and spend a [mental] resource →").
   * Selecting nothing (or too little) declines to trigger it.
   */
  | {
      readonly kind: "payForAbility";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly cost: number;
      /**
       * The cost is a number of resources the player chooses (`AbilityCost.resources { choose }`; docs/phase7-wave8.md
       * §3.62): the selection must generate at least `min` resources in all, a card with two icons counting two; up
       * to `max` of them are paid and the rest overpaid (owner decision, 2026-10-08, §4.1 row 78; RRG 1.8 "Cost",
       * p. 13). `cost` is then 0. Selecting nothing declines; a selection that generates fewer than `min` is refused by
       * `resolveChoice` and the choice stays pending. `payingFor`: the card
       * the resources are generated for, which is what the selection is priced against.
       */
      readonly chosenResources?: { readonly min: number; readonly max: number; readonly payingFor: InstanceId };
    }
  /**
   * An effect asks for a payment ("either spend [E][M][P] resources or …"). Selecting nothing (or too little) declines.
   *
   * `distinctTypes` (docs/phase7-wave6.md §3.69, "spend 2 different resources"): present only when the effect asks for
   * it. The payment must also hold this many resource types, a wild being any one type; fewer declines.
   */
  | {
      readonly kind: "spendResources";
      readonly requirement: ResourceRequirement;
      readonly distinctTypes?: number;
      /**
       * The payment is an additional cost to change form, asked as a player card's effect changes the player's form
       * (`RuleSpec formChangeCost`; docs/phase7-wave8.md §3.63): the form being changed to and the cards the cost is
       * printed on. `sameType`: that many of the resources must be of one type, a wild being any type ("2 resources
       * of the same type"); present only when the cost asks for it. Declining leaves the form as it is.
       */
      readonly formChangeCost?: {
        readonly to: Form;
        readonly sourceInstanceIds: readonly InstanceId[];
        readonly sameType?: number;
      };
    }
  /**
   * The wilds of a payment just made for the card `instanceId` are declared (docs/phase7-wave8.md §3.62, §4.1 Q33 = B;
   * RRG 1.8 "Wild Resource", p. 48: the player "may specify which resource type (energy, mental, physical, or wild) it
   * is being used as"). Asked only when a card reads the types that paid and the declaration can change what it reads;
   * the engine never picks for the player and preselects nothing.
   *
   * Four options per wild, `<n>:<type>` with n from 0 in the order the payment generated them and type one of
   * `energy`, `mental`, `physical`, `wild` (left as a wild). Exactly `wilds` are selected, one for each wild, and the
   * payment must still pay `requirement` with the wilds used as declared (`resolveChoice` checks both through
   * `wildDeclarationFault`). `pool` is everything the payment generated, wilds included, and `requirement` what the
   * cost took: the resources beyond it are overpaid and are not read (§4.1 Q34 = A). `only`: the card may be paid for
   * with those types alone.
   */
  | {
      readonly kind: "declareWildTypes";
      readonly instanceId: InstanceId;
      /** The payment was for this ability of the card (`useAbility`, a window's `payForAbility`), not for playing it. */
      readonly abilityId?: AbilityId;
      readonly wilds: number;
      readonly pool: ResourcePool;
      readonly requirement: ResourceRequirement;
      readonly only?: readonly TypedResource[];
    }
  /**
   * Which resources of a payment just made for the card `instanceId` count as paid (owner decision, 2026-10-08,
   * docs/phase7-wave8.md §4.1 row 79). The payment generated more than the cost took, the rules do not say which
   * resources are the overpaid ones (RRG 1.8 "Cost", p. 13), and a card that reads the types that paid reads the
   * candidate sets differently: which line of "[physical] … [mental] … [energy] …" fires. Asked after any wilds are
   * declared, by the same frame, and never when every set reads the same.
   *
   * One option per set in `sets`, in the same order, its `optionId` `paidSetOptionId` of the set
   * (`physical:1,mental:1,energy:0,wild:1`) and its label the set in words; exactly one is selected. Each set holds
   * `paidCount` resources out of `pool` (everything generated, each wild counted as the type it was declared), fills
   * the cost's typed slots, and has as many types as any other (§4.1 Q34 = A). The rest of `pool` is overpaid.
   */
  | {
      readonly kind: "choosePaidResources";
      readonly instanceId: InstanceId;
      /** The payment was for this ability of the card, not for playing it. */
      readonly abilityId?: AbilityId;
      readonly pool: ResourcePool;
      readonly paidCount: number;
      readonly sets: readonly ResourcePool[];
    }
  /**
   * `EffectSpec chooseNumber` (docs/phase7-wave6.md §3.69): "any number of …". One option per whole number from `min`
   * to `max`, its `optionId` and label the number itself; exactly one is selected.
   */
  | { readonly kind: "chooseNumber"; readonly min: number; readonly max: number }
  /**
   * An effect has the player choose one entry of a fixed, enumerated list (`EffectSpec chooseCardType`,
   * docs/phase7-wave7.md §3.33): one option per entry, its `optionId` the entry's id and its label the entry's name;
   * exactly one is selected. `list` says what is being chosen, for the prompt's title.
   */
  | { readonly kind: "chooseFromList"; readonly list: ChoiceList }
  /**
   * `EffectSpec searchCollection` (docs/phase7-wave7.md §3.81; RRG 1.8 "Search", p. 39): the options are cards
   * outside the game, so each names a card definition (`ChoiceRef cardDefinition`, its `optionId` the card id) rather
   * than a card instance. At most one is selected; none finds nothing.
   */
  | { readonly kind: "searchCollection"; readonly slot: string }
  /**
   * `EffectSpec reportFact` (docs/phase7-wave7.md §3.83): `playerId` reports a fact from outside the game, and only
   * that player may answer. Exactly one selection.
   *
   * `answer: "yesNo"`: the options are `yes` and `no`. `answer: "wholeNumber"`: there are **no options**, because the
   * number has no upper bound; the one selection is the number itself in decimal digits (`"0"`, `"7"`, `"125"`; no
   * sign, no leading zero, at most `Number.MAX_SAFE_INTEGER`), which `resolveChoice` checks (`reportedNumberOf`).
   *
   * The engine waits on this choice like any other and measures nothing: a client that times a break keeps the
   * choice open while its clock runs and answers when the break ends.
   */
  | { readonly kind: "reportFact"; readonly fact: ReportedFact; readonly answer: ReportedFactAnswer }
  /**
   * `EffectSpec pairCards` (docs/phase7-wave8.md §3.36; MC45 p. 6, step 2 of a mission attempt): assign each of
   * `cards` to a different one of `with`. One option per card and character, its `optionId` `<card>><character>`
   * (`pairOptionId`), its `ref` the character and its label "card → character". The selection is the whole
   * assignment: any number of options from none to the smaller of the two counts, no card and no character twice
   * (`resolveChoice` checks through `pairSelectionFault`; a refused selection leaves the choice open).
   *
   * `icons`: the resource types of each card (printed) and each character (printed plus considered), by instance id.
   * `matching`: the option ids whose pair matches, so a client can show which characters would take part before the
   * player commits. `limit`: a restriction in force ("cards with the same resource icon cannot be assigned to more
   * than one ally"), which the selection must also satisfy. `sourceInstanceId`: the card whose ability asks.
   */
  | {
      readonly kind: "pairCards";
      readonly cards: readonly InstanceId[];
      readonly with: readonly InstanceId[];
      readonly icons: Readonly<Record<string, readonly ResourceType[]>>;
      readonly matching: readonly string[];
      readonly limit?: PairLimit;
      readonly sourceInstanceId: InstanceId | null;
    }
  /** RRG "Ally Limit": the controller discards allies down to their ally limit. */
  | { readonly kind: "discardOverAllyLimit"; readonly limit: number }
  /** RRG 1.8 "Player Side Scheme Limit" (p. 34): choose the player side scheme(s) in play to discard down to `limit`. */
  | { readonly kind: "discardOverPlayerSideSchemeLimit"; readonly limit: number }
  /** RRG "Restricted": the controller discards down to two restricted cards. */
  | { readonly kind: "discardRestricted"; readonly limit: number }
  /**
   * RRG 1.8 "Indirect Damage" (p. 24): divide `amount` among these characters, at most `caps[instanceId]` each (its
   * remaining hit points). Options are `<instanceId>#<n>` for n = 1…cap; each selected option is 1 damage to that
   * character, and exactly `amount` must be selected.
   */
  | { readonly kind: "assignIndirectDamage"; readonly amount: number; readonly caps: Readonly<Record<string, number>> }
  /**
   * `EffectSpec divideDamageEvenly`: every option's character already gets `each` damage; select exactly `amount`
   * different characters to take 1 more (the remainder of an uneven division).
   */
  | { readonly kind: "divideEvenlyRemainder"; readonly amount: number; readonly each: number }
  /**
   * `EffectSpec divide` (docs/phase7-wave2.md §3.7): split `amount` among the options' cards. Options are
   * `<instanceId>#<n>` for n = 1…amount; each selected option is 1 point to that card, and exactly `amount` are selected.
   *
   * `maxTargets`: the selected options name at most this many different cards. `caps` (a status division): card id to
   * the most status cards it can take; its options stop there, and the selection must give as many as `amount` and
   * the chosen cards' combined caps allow (`resolveChoice` checks both).
   *
   * `what: "heal"`: `amount` is the damage that will be healed (already no more than the options' cards hold), and a
   * card has one option per damage on it, up to `amount`.
   *
   * `eachAtLeast`: every card among the options gets at least this many points (a divided basic power's shares, each
   * "at least 1": `basicPowerBy`); `resolveChoice` refuses a selection that leaves one short.
   *
   * `what: "counters"` (docs/phase7-wave9.md §3.27): `amount` counters of `counterType` (`"any"`: of any type) are
   * removed, already no more than the options' cards hold; a card has one option per counter on it, up to `amount`.
   */
  | {
      readonly kind: "divide";
      readonly what: "damage" | "threat" | "heal" | "counters" | StatusName;
      /** With `what: "counters"`: the counter type being removed. */
      readonly counterType?: string;
      readonly amount: number;
      readonly maxTargets?: number;
      readonly caps?: Readonly<Record<string, number>>;
      readonly eachAtLeast?: number;
    };

export type ChoiceRef =
  | { readonly kind: "card"; readonly instanceId: InstanceId }
  /** A card that is not in the game: printed card data of the game's card pool (`GameState.cardPool`). */
  | { readonly kind: "cardDefinition"; readonly cardId: CardId }
  | { readonly kind: "player"; readonly playerId: PlayerId }
  | { readonly kind: "ability"; readonly instanceId: InstanceId; readonly abilityId: AbilityId }
  | { readonly kind: "none" };

type CardTotal = NonNullable<Extract<ChoicePrompt, { kind: "chooseCards" }>["maxTotal"]>;

/** What the selected cards of a `chooseCards` choice with `maxTotal` add up to. */
export const cardTotalOf = (limit: CardTotal, selected: readonly string[]): number =>
  selected.reduce((sum, optionId) => sum + (limit.values[optionId] ?? 0), 0);

/** Why a selection breaks a `chooseCards` choice's `maxTotal`, or null (docs/phase7-wave9.md §3.11). */
export function cardTotalFault(limit: CardTotal, selected: readonly string[]): string | null {
  const total = cardTotalOf(limit, selected);
  return total > limit.atMost
    ? `the cards chosen have a combined printed cost of ${total}; the most allowed is ${limit.atMost}`
    : null;
}

/** The most cards of `values` that fit under `atMost` together: the cheapest first. */
export function mostCardsUnderTotal(values: readonly number[], atMost: number): number {
  let total = 0;
  let count = 0;
  for (const value of [...values].sort((a, b) => a - b)) {
    if (total + value > atMost) break;
    total += value;
    count++;
  }
  return count;
}

/** The option of an effect play's destination choice that plays the card to its player's own play area. */
export const PLAY_TO_OWN_AREA = "playTo:ownArea";
const PLAY_TO_AREA_PREFIX = "playTo:area:";
/** The option that plays it into the in-play scenario area `area` (the mission area). */
export const playToAreaOption = (area: string): string => `${PLAY_TO_AREA_PREFIX}${area}`;
/**
 * What an option id of that choice names: `null` for the player's own area, the area's name, or `undefined` when the
 * id is not one of them (any other `chooseOption`).
 */
export const playDestinationOfOption = (optionId: string): string | null | undefined =>
  optionId === PLAY_TO_OWN_AREA
    ? null
    : optionId.startsWith(PLAY_TO_AREA_PREFIX)
      ? optionId.slice(PLAY_TO_AREA_PREFIX.length)
      : undefined;

export interface ChoiceOption {
  readonly optionId: string;
  readonly label: string;
  readonly ref: ChoiceRef;
}

/**
 * Why this player is the one deciding. There is no villain player: the
 * encounter side's procedure is forced, and every decision it leaves open
 * belongs to a player by rule (docs/phase3-encounter-ai.md).
 *
 * - `player`: the player's own decision — their cards, their defense, their
 *   payments, a "choose" on an ability they are resolving (RRG "Choose").
 * - `firstPlayerTargets`: an encounter card targets a player or card and several
 *   are eligible, so the first player selects on the encounter card's behalf
 *   (RRG "First Player").
 * - `firstPlayerOrders`: effects that would resolve simultaneously; the first
 *   player orders them (RRG "First Player", "Simultaneous Resolution").
 */
export type DecisionAuthority = "player" | "firstPlayerTargets" | "firstPlayerOrders";

/**
 * The engine never calls back into a client. When the rules need input it
 * parks a fully described choice here and waits for a `resolveChoice` command.
 * `frameId` names the stack frame the answer belongs to, or null for a choice
 * owned by the phase structure itself.
 */
export interface PendingChoice {
  readonly choiceId: ChoiceId;
  readonly playerId: PlayerId;
  readonly prompt: ChoicePrompt;
  readonly minSelections: number;
  readonly maxSelections: number;
  readonly options: readonly ChoiceOption[];
  readonly frameId: FrameId | null;
  /** True when the order of the selections is itself the answer. */
  readonly ordered: boolean;
  /**
   * RRG "Peril": a peril card is on the stack, so only `playerId` may decide —
   * no table talk, and no other player may play cards or trigger abilities
   * while this choice is open. The engine only marks it; clients and netcode
   * enforce the social half.
   */
  readonly soleDecider: boolean;
  /** Whose decision this is by rule; anything but `player` is made on the encounter side's behalf. */
  readonly authority: DecisionAuthority;
}
