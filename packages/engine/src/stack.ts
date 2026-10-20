import type { AbilityId, CardId } from "@mc/content";
import type { AbilitySource } from "./abilities.js";
import type { CostChoices } from "./commands.js";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import {
  RESOURCE_TYPES,
  type PaidTypesRead,
  type ResolvedRequirement,
  type ResourcePool,
  type ResourceType,
  type TypedResource,
} from "./resources.js";
import type { BasicPowerName, EffectSpec, StatName } from "./spec.js";
import type { PlayedFrom, TriggerEvent } from "./trigger-events.js";
import type { ZoneId } from "./state.js";

/**
 * The resolution stack. `state.stack[0]` is what is resolving right now;
 * everything after it is queued. Frames are plain data with an explicit cursor
 * so resolution can suspend on a `PendingChoice` and resume exactly where it
 * left off — `runFlow` steps the top frame the same way it steps `state.step`.
 */

/** Which half of a timing window a trigger window is filling. */
export type WindowTiming = "interrupt" | "response";

/** One candidate ability waiting to be resolved inside a trigger window. */
export interface TriggerCandidate {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  readonly controllerId: PlayerId | null;
  readonly forced: boolean;
  /** An event card played from hand inside this window; it still has to be paid for. */
  readonly fromHand: boolean;
  /**
   * The triggering condition this candidate answers when it is not the window's own event: one of the window's
   * `alsoEvents` (`index` into that list), a condition the same occurrence created (RRG 1.8 "Triggering Condition",
   * p. 45). Absent for the window's own event.
   */
  readonly sharedEvent?: { readonly index: number; readonly event: TriggerEvent };
  /**
   * On a candidate whose pattern answers an occurrence once (`EventPattern.together`): every condition of the window
   * that matched it, in the order they resolved, the one it answers first. Its ability frame names their targets in
   * the slot `TOGETHER_TARGETS_SLOT`.
   */
  readonly together?: readonly TriggerEvent[];
}

export const candidateOf = (source: AbilitySource, forced: boolean): TriggerCandidate => ({
  instanceId: source.instanceId,
  abilityId: source.abilityId,
  controllerId: source.controllerId,
  forced,
  fromHand: false,
});

/** Slot bindings produced by `chooseTarget`, carried through an effect program. */
export type Bindings = Readonly<Record<string, readonly InstanceId[]>>;

/** Named numbers bound while an ability resolves (cost results, "X", paid resources, effect results). */
export type Vars = Readonly<Record<string, number>>;

/** Where a reveal began (the reveal frame's `source`; docs/phase7-wave6.md §3.64). */
export type RevealSource = "encounterDeck" | "elsewhere";

/** A keyword that answers a revealed minion's engagement once its reveal has finished (`Frame<"reveal">.keywordOrder`). */
export type RevealKeyword = "quickstrike" | "teamwork";

/**
 * The one thwart a "(thwart)" ability makes (RRG 1.8 "Thwart", p. 44: "An ability labeled as a thwart is considered a
 * single thwart, even if that thwart removes multiple instances of threat"), carried by the root effects frame of the
 * ability's resolution from its first instance of threat removal on. See `resolve/thwart-session.ts`.
 */
export interface ThwartSession {
  readonly thwarterInstanceId: InstanceId;
  readonly playerId: PlayerId;
  readonly sourceInstanceId: InstanceId | null;
  /** "That thwart removes N additional threat" (`modifyThwart`): added to each instance (docs/phase7-wave6.md §4.1 Q78). */
  readonly extraThreat: number;
  /** The thwart was cancelled in its interrupt window: the remaining instances do not resolve, nothing answers it. */
  readonly cancelled?: true;
  /** The instances that have resolved, in order: the scheme and the threat actually removed from it. */
  readonly instances: readonly { readonly schemeInstanceId: InstanceId; readonly amount: number }[];
  /** The instances' results, summed (`threatRemoved`, …): the resolved thwart's `results`. */
  readonly results: Vars;
  /** Its resolved event has been pushed (or it had nothing to announce). */
  readonly announced?: true;
}

/** Where an event frame reports its results when it finishes: `<prefix>.<key>` is added to that frame's vars. */
export interface ReportTarget {
  readonly frameId: FrameId;
  /** `null`: no results are written; the target only hears whether the event happened (`gatesThen`). */
  readonly prefix: string | null;
  /**
   * The event is part of that effects frame's pre-"then" text: if it does not happen (cancelled, skipped), the frame is
   * marked unresolved and a later `then` in it is skipped (RRG 1.8 "'Then'", p. 44; `resolve/then.ts`).
   */
  readonly gatesThen?: boolean;
}

/**
 * The boost card an activation is resolving (RRG 1.8 "Boost", p. 11): `window` while the interrupts to its
 * `boostCardTurnedFaceup` event resolve, `ability` while its "Boost" ability resolves, `responses` while that event's
 * responses resolve (RRG 1.8 "Simultaneous Timing Priority", p. 5: interrupts, then the Boost ability, then responses).
 * Its icons are added and it is discarded after that.
 */
export interface BoostInProgress {
  readonly instanceId: InstanceId;
  /**
   * `count`: its icons are about to be counted (`boostIconsCounting`; docs/phase7-wave2.md §3.6). `resolved`: counted
   * (`icons`), its `boostCardResolved` response window open before the discard (docs/phase7-wave5.md §3.5).
   */
  readonly step: "window" | "ability" | "responses" | "count" | "resolved";
  /** With `step: "resolved"`: the icons it adds. */
  readonly icons?: number;
  readonly iconsCancelled: boolean;
  readonly abilityCancelled: boolean;
  /**
   * Its boost icons and "Boost" ability are ignored (`RuleSpec ignoreBoost`, docs/phase7-wave7.md §3.67): it adds 0
   * and its ability does not resolve, neither being canceled. Set when the rule is first seen to cover the card.
   */
  readonly ignored?: true;
  /** The boost icons its `boostCardTurnedFaceup` event announced at the flip, announced again to its responses. */
  readonly turnedIcons?: number;
  /** The event frame of its `boostCardTurnedFaceup` interrupts (`responsesLater`), while they resolve. */
  readonly turnedFrameId?: FrameId;
  /** That event was cancelled in its interrupt window: not considered to have occurred, so no responses follow it. */
  readonly turnedCancelled?: true;
  /** "Increase or decrease the number of boost icons on that card by 1 for this count" (`adjustBoostCount`). */
  readonly countAdjust?: number;
  /** "Count the number of boost icons on that card instead" (`replaceBoostCount`): the card whose icons are counted. */
  readonly countFrom?: InstanceId;
}

/** Effects waiting for a timing point ("at the end of this attack"), with the context that created them. */
export interface DeferredEffects {
  readonly effects: readonly EffectSpec[];
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly bindings: Bindings;
  readonly vars: Vars;
  /**
   * An "at the end of this attack" delayed effect (`atEndOfAttack`): it resolves as the attack finishes, before the
   * attack's step 6 responses (RRG 1.8 "Delayed Effect", p. 16; `pushDelayedEndEffects`). Unset for an effect queued
   * behind the activation (an "after this activation ends" effect, or an activation queued behind this one), which
   * waits for those responses.
   */
  readonly delayed?: true;
}

/**
 * The printed setup instruction an effects frame resolves: a campaign instruction (`resolveCampaignWindow`) or a
 * scenario's own setup instruction (`resolveScenarioSetupInstructions`). Neither is a card, so the frame's
 * `selfInstanceId` is null; this is what names the source of a choice raised inside one ("each player must search
 * the encounter deck … for a minion", MC27 p. 22). Every effects frame pushed from such a frame carries it on.
 */
export interface SetupInstructionSource {
  readonly kind: "campaign" | "scenario";
  readonly instructionId: string;
  readonly text: string;
  readonly citation: string;
}

/**
 * A consequential-scoped damage-taken rule (`ConsequentialDamageScope`) whose source left play while the power its
 * damage follows was resolving, kept on that damage's frame with what it does (docs/phase7-wave6.md §4.1 Q50).
 * `amount` is 0 for `preventAllDamage`.
 */
export interface LingeringDamageRule {
  readonly sourceInstanceId: InstanceId;
  readonly kind: "reduceDamageTaken" | "increaseDamageTaken" | "preventAllDamage";
  readonly amount: number;
}

/**
 * A payment whose wilds its player has still to declare (docs/phase7-wave8.md §3.62, §4.1 Q33 = B), kept on the play
 * frame of the card paid for (or the frame of the ability paid for) until the `declareWildTypes` choice is answered: everything the payment generated, what
 * the cost took (the rest is overpaid), and the types the card may be paid with when it limits them (`paymentOnly`).
 *
 * The same record holds a payment whose **paid resources** its player has still to name (`choosePaidResources`; owner
 * decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 79): `reads` is everything that reads the payment's types, which
 * is what tells whether two sets of paid resources differ, and `declared` the wilds once they are declared (on the
 * command, by the choice, or left as they are because no declaration could matter: `skipped`), after which only the
 * paid set is left to ask.
 */
export interface UndeclaredWilds {
  readonly pool: ResourcePool;
  readonly requirement: ResolvedRequirement;
  readonly only?: readonly TypedResource[];
  readonly reads?: readonly PaidTypesRead[];
  readonly declared?: { readonly types: readonly ResourceType[]; readonly skipped: boolean };
}

interface FrameBase {
  readonly frameId: FrameId;
  /** Selections fed back by `resolveChoice`; the frame reads and clears it. */
  readonly answer: readonly string[] | null;
}

/** A var on a frame that counts each ability that resolved (`Frame<"ability">.resolvedCounts`). */
export interface ResolvedCountVar {
  readonly frameId: FrameId;
  readonly name: string;
}

export type StackFrame =
  /** An event with its interrupt window, its state change, and its response window. */
  | (FrameBase & {
      readonly kind: "event";
      readonly event: TriggerEvent;
      readonly stage: "interrupts" | "apply" | "responses" | "done";
      readonly cancelled: boolean;
      /** Results accumulated while the event resolves (see `TriggerEvent.results`). */
      readonly vars: Vars;
      /** Cards the event's results name (`damaged`, `target`), reported as slots like `vars`. */
      readonly slots: Bindings;
      readonly reportTo: ReportTarget | null;
      /**
       * Effects held for the end of this activation. The `delayed` ones ("at the end of this attack") run before its
       * step 6 response window, the rest after it.
       */
      readonly endEffects: readonly DeferredEffects[];
      /**
       * An enemy activation or attack that began and then ended before resolving: its enemy left play (RRG 1.8
       * "Activation", p. 6; ruling January 11, 2026 - Ruling 1, answer 3), or a cancel effect cancelled the enemy
       * attack in its interrupt window (FFG ruling Feb 15, 2024, Ruling 148: "the attack is still considered to 'end'").
       * The frame is `cancelled` so that nothing more of it resolves (no damage, no "after … attacks" responses), but
       * its end is still a timing point, so its `endEffects` resolve. Not set for a replaced attack, nor for one a
       * stunned status card or "cannot activate" stopped before it was initiated.
       */
      readonly endedEarly?: true;
      /**
       * An enemy attack queued ahead of the moment it is made (a keyword's attack waiting behind the responses to its
       * minion's entering play, `quickstrikeFrame`), so nothing has yet asked whether a stunned status card replaces
       * it: read as the attack would begin (RRG 1.8 "Stun, Stunned", p. 41; `resolve/event.ts`). The villain phase and
       * the "X attacks" effects ask before they push their event and do not set this.
       */
      readonly statusReplaces?: true;
      /**
       * Events whose *response* window was deferred to the end of this activation: RRG 1.8 "Defend, Defense" (p. 16),
       * "Abilities that trigger after a character defends an attack resolve after that attack ends." Only an
       * activation event frame (`enemyAttack`) carries these; `resolve/event.ts` opens them in its `done` stage.
       */
      readonly deferredResponses?: readonly TriggerEvent[];
      /**
       * The first player to resolve a "(defense)"-labeled ability during this enemy attack: RRG 1.8 "Defend, Defense"
       * (p. 15), "Once a player resolves a defense-labeled ability during an enemy attack, other players cannot
       * resolve defense-labeled abilities for that same attack." Only an `enemyAttack` event frame carries it, so it
       * ends with the attack (`defense-claim.ts`).
       */
      readonly defenseLabeledBy?: PlayerId;
      /**
       * One occurrence, several triggering conditions, one response window (RRG 1.8 "Triggering Condition", p. 45;
       * `pushEventsSharingResponses`): this event's responses join the window of the event frame `responsesWith`, which
       * resolves after it. Resolving this frame hands its resolved event to that frame's `joinedResponses` instead of
       * opening its own window. Its interrupt window, apply step and "each time" effects are its own.
       */
      readonly responsesWith?: FrameId;
      /**
       * Only this event's interrupt window and apply step are this frame's: its responses are announced by a later
       * frame for the same event, pushed at `stage: "responses"` once something else has resolved in between. A boost
       * card turned faceup is the one user: its interrupts, then its "Boost" ability, then its responses (RRG 1.8
       * "Simultaneous Timing Priority", p. 5; owner decision, 2026-10-16, audit finding 10 B; `stepBoostCard`). The
       * frame ends after its apply step, with no "resolved" line, no response window and no "each time" effects.
       */
      readonly responsesLater?: true;
      /** Events handed over by frames whose `responsesWith` is this one; this frame's response window gathers them. */
      readonly joinedResponses?: readonly TriggerEvent[];
      /**
       * Announcements of moves made during this event's own interrupt window, pushed once this frame finishes, after
       * its "cancelled" line if it was cancelled (docs/phase7-wave5.md §4.1 Q34): a replacement ("tuck it here
       * instead") moved the leaving card, and its `cardLeavesPlay` (responses only) follows the replaced one's end.
       */
      readonly announceAfter?: readonly TriggerEvent[];
      /**
       * An attack or thwart's `keywordIgnored` events (docs/phase7-wave6.md §3.8), recorded as it applies and announced
       * in one shared response window once this frame finishes (`resolve/keyword-ignored.ts`).
       */
      readonly keywordsIgnored?: readonly TriggerEvent[];
      /**
       * A member of a simultaneous `damageGroup`: this frame runs only the interrupt window, then hands its (possibly
       * prevented or cancelled) event back to the group at `index`, which applies it with the others.
       */
      readonly group?: { readonly frameId: FrameId; readonly index: number };
      /** A thwart whose additional cost (`RuleSpec additionalThwartCost`) has been asked for (docs/phase7-wave5.md §3.21). */
      readonly thwartCostAsked?: true;
      /**
       * A basic thwart whose additional cost was paid with its own costs, before it was initiated (docs/phase7-wave5.md
       * §4.1 Q27, `thwart-cost.ts`): not asked again as it resolves.
       */
      readonly thwartCostPaid?: true;
      /**
       * A later instance of a "(thwart)" ability's one thwart, cancelled because that thwart was cancelled in its
       * interrupt window (`ThwartSession.cancelled`): it ends without a log line of its own.
       */
      readonly thwartInstanceCancelled?: true;
      /**
       * On a player's `attack` event made by an "(attack)"-labeled ability with its controller's identity: the root
       * effects frame of that ability's resolution. The ability is one attack (RRG 1.8 "Attack (Player Ability Type)",
       * p. 10), so this attack does not finish with its own damage: it waits beneath that frame until the ability's
       * last effect has resolved (`resolve/attack-ability.ts`).
       */
      readonly attackOf?: FrameId;
      /**
       * With `attackOf`: this attack has dealt its own damage and is waiting beneath its ability's root frame for the
       * rest of the ability. Damage the ability deals to enemies meanwhile is this attack's. Once the ability's
       * frame is gone the attack finishes: every enemy attacked (`attacked`), then "after … attacks", then "at the
       * end of this attack". While it waits it is not "this attack" to `currentActivationFrameId`. Cleared as the
       * attack starts to finish (`pushAttackedByAbility`), so it is "this attack" again for its retaliate events, its
       * "after … attacks" window and its "at the end of this attack" effects.
       */
      readonly attackWaiting?: true;
      /**
       * With `attackOf`: the attack's target was changed in its "when … attacks" window (`EffectSpec retargetAttack`),
       * off `from` (the enemy it was made against) onto `to`. The event's own target is `to` from then on. Kept on the
       * frame because the damage of an "(attack)" ability's attack is also dealt by the ability's instructions, which
       * name `from`: each instance of this attack's damage aimed at `from` is dealt to `to`, and `to` is the
       * character attacked (`resolve/attack-ability.ts`, "A target changed in the attack's window").
       */
      readonly attackRetarget?: { readonly from: InstanceId; readonly to: InstanceId };
      /**
       * With `attackOf`: the enemies this attack has attacked so far, one `characterAttacked` each (its own target,
       * then every enemy a later instruction of the ability targeted), pushed when the attack finishes. An enemy
       * named twice is attacked once. Only an instruction's own targets are added: an enemy that merely took damage
       * from the attack (an overkill spill) is not attacked (owner ruling Q50; `resolve/attack-ability.ts`).
       */
      readonly attacked?: readonly Extract<TriggerEvent, { kind: "characterAttacked" }>[];
      /**
       * On a player's `attack` event: the enemies this attack has been made against and charged for (`RuleSpec
       * additionalAttackCost`, docs/phase7-wave10-hero-packs.md H3.16; `attack-cost.ts` `chargeAttackCosts`), whether
       * or not a cost was owed for them. The events of one "(attack)" ability (`attackOf`) read each other's, so an
       * enemy is paid for once per attack.
       */
      readonly attackCostsCharged?: readonly InstanceId[];
      /**
       * With `attackOf`: this attack began as its ability began resolving, before the `attack` instruction that deals
       * its damage (RRG 1.8 "Labeled Ability", p. 26; owner decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 73), and
       * no `attack` instruction has taken it over yet. Its interrupt window has resolved and it waits beneath the
       * ability's root frame; the ability's first `attack` instruction by that identity puts it back on top to deal
       * its damage (`resumeBegunAttack`, `resolve/attack-ability.ts`) and clears this. Still set when the attack
       * finishes: no instruction made it, so it attacked only the enemies the ability's damage instructions named.
       */
      readonly attackBegun?: true;
      /**
       * On an attack whose damage is all prevented (`modifyAttack.preventAllDamage` with a `bind`,
       * docs/phase7-wave9.md §3.4): where each instance the prevention stops is recorded, as this frame's vars
       * `attackPreventedVars(bind)`. `targetInstanceId`: the character a player attack was against when the effect
       * resolved, whose instances `<bind>.amount` counts; null counts every instance (an enemy attack, a player attack
       * that had named no enemy yet).
       */
      readonly preventAllReports?: readonly { readonly bind: string; readonly targetInstanceId: InstanceId | null }[];
      /**
       * On a `cardEntersPlay` event not yet initiated: a standing check of the card (`stateCheck.fromEntering`) resolved
       * the moment the card was in play, before this event's windows. If the card is out of play when the event's turn
       * comes, the event ends there: no interrupt, no enter-play keyword, no response (`resolve/state-checks.ts`).
       */
      readonly standingCheckResolved?: true;
      /**
       * On an ally's pending consequential damage: the consequential-scoped damage-taken rules that applied to it when
       * their source left play while the attack or thwart it follows was still resolving (`lingeringConsequentialRules`,
       * docs/phase7-wave6.md §4.1 Q50). Each still applies to this damage, read as last known information.
       */
      readonly lingeringDamageRules?: readonly LingeringDamageRule[];
    })
  /**
   * Damage events resolved simultaneously (RRG 1.8 "Indirect Damage", p. 24: "All indirect damage from a single source
   * is first assigned and then resolved simultaneously"): every member's interrupt window in order, then every
   * member's damage followed by one defeat sweep, then every member's response window.
   */
  | (FrameBase & {
      readonly kind: "damageGroup";
      readonly members: readonly {
        readonly event: Extract<TriggerEvent, { kind: "dealDamage" }>;
        readonly cancelled: boolean;
        /** What applying it did (`amount` taken, `excessDealt`), for its response window's results. */
        readonly vars: Vars;
      }[];
      readonly stage: "interrupts" | "apply" | "responses" | "done";
      readonly cursor: number;
      readonly reportTo: ReportTarget | null;
    })
  /** Gathers, orders, and runs the triggered abilities for one timing window. */
  | (FrameBase & {
      readonly kind: "window";
      readonly event: TriggerEvent;
      /**
       * Other triggering conditions of the same occurrence, sharing this window (RRG 1.8 "Triggering Condition", p. 45):
       * their candidates are gathered with `event`'s and tiered with them, forced before optional (p. 5). Their own
       * event frames have finished, so an ability answering one of them has no `eventFrameId`.
       */
      readonly alsoEvents?: readonly TriggerEvent[];
      /**
       * The event frame of each of `alsoEvents`, by index, when it is still to apply: an interrupt window several
       * events share (cards leaving play together, docs/phase7-wave5.md §4.1 Q32–Q33), where an interrupt answering
       * one of them can cancel or replace that one. Absent (or null) for a condition whose frame has finished.
       */
      readonly alsoEventFrameIds?: readonly (FrameId | null)[];
      readonly timing: WindowTiming;
      readonly eventFrameId: FrameId | null;
      /** Index into the priority tier list for this timing (RRG "Simultaneous Timing Priority"). */
      readonly tierIndex: number;
      /**
       * An interrupt window some `would` interrupt answers (`trigger.would`, RRG 1.8 "'Would'", p. 48): the index into
       * the same tier list for the "would" interrupts, which all resolve before `tierIndex` starts on the others. Set
       * as the window is pushed and removed once the "would" tiers are done; absent on every other window.
       */
      readonly wouldTier?: number;
      readonly queue: readonly TriggerCandidate[];
      /**
       * The optional candidates, fixed when the window opened together with the forced ones (docs/phase7-wave6.md
       * §3.79): RRG 1.8 "Response" (p. 38) and "Interrupt" (p. 25) let an ability resolve when *its* triggering
       * condition occurs ("Triggering Condition", p. 45: "a specific occurrence"), so an ability whose condition only
       * became true while the forced tier resolved (Phased's forced flip turning Solid faceup) did not answer this
       * occurrence. Absent until the window opens; `stillOffered` drops one that can no longer be initiated.
       */
      readonly optionalAtOpen?: readonly TriggerCandidate[];
      /**
       * Set when a player picked an optional ability in the round of `chooseTriggers` prompts now resolving. RRG 1.8
       * "Response" (p. 36) and "Interrupt": several may be triggered from one triggering condition, each once, until
       * "all players decide they do not wish to resolve any (further)" ones; "In Player Order" (p. 24): the sequence
       * of opportunities continues until it is complete. So once the picked ones have resolved, the ones left in
       * `pending` are offered again, and the tier ends with a round in which nobody picks.
       */
      readonly pickedThisRound?: true;
      /**
       * Interrupt windows only: the optional abilities that were live as the window opened and listen for this kind
       * of event (`hearersOf`), by key, whether or not their whole condition was met then. One of them whose
       * condition comes to be met while the window is open, before the event resolves, is offered then ("When you
       * make a basic attack against an enemy with an upgrade attached", after another interrupt attached one): RRG 1.8
       * "Interrupt" (p. 25), the triggering condition is still imminent, and "Initiating Abilities" (p. 24), an ability
       * is checked as it is initiated. An ability that was not live at the open is never in this list, so the rule of
       * `optionalAtOpen` stands for it. Offered ones join `optionalAtOpen`, so none is offered twice.
       */
      readonly heardAtOpen?: readonly string[];
      /**
       * Interrupt windows only, and only when the window has forced interrupts to resolve: which face each
       * double-sided card in play was showing as the window opened (`CardInstance.flipped`, by instance). A card
       * here that shows its other face once the forced tier is done was turned faceup by this window's own forced
       * interrupts, and that face's optional interrupts to the occurrence join the optional tier (docs/phase7-wave9.md
       * §3.8: "Forced Interrupt: When you attack, change to Assault suit form" before Assault's own "Interrupt: When
       * you attack"). RRG 1.8 "Interrupt" (p. 25): an interrupt resolves "immediately before that triggering condition
       * resolves", so the attack is still to happen when the face turns up; forced before optional is "Ability",
       * Simultaneous Timing Priority (p. 5). The rule of `optionalAtOpen` stands for everything else: a card that
       * entered play or a hand during the forced tier, any response window, and the forced tier itself.
       */
      readonly facesAtOpen?: Readonly<Record<InstanceId, boolean>>;
      /** Optional tiers ask each controller in player order; this is who is left to ask. */
      readonly askingPlayerIds: readonly PlayerId[];
      readonly pending: readonly TriggerCandidate[];
      readonly awaiting: "order" | "select" | "pay" | "costPick" | "costCounters" | null;
      /** The in-hand event whose cost the window is currently collecting. */
      readonly paying: TriggerCandidate | null;
      /**
       * The cards in play the player picked so far for the queued candidate's cost ("exhaust an [Avenger] character
       * and a [Guardian] character", docs/phase7-wave4.md §3.17), keyed by `<instanceId>:<abilityId>` so picks never
       * outlive their candidate. Absent until a window asks for one.
       *
       * `counters`: how many counters the candidate's "up to N" counter cost removes ("remove up to 3 charge counters
       * from here →", Throw de Card; docs/phase7-wave6.md §3.53), once the player has chosen (`chooseCostCounters`).
       * Cleared when the candidate is paid for, so a later use of the same ability is asked again.
       */
      readonly costPicks?: {
        readonly key: string;
        readonly choices: CostChoices;
        readonly asking?: string;
        readonly counters?: number;
      };
    })
  /** Resolves one ability: checks its limit, records the use, runs its effects. */
  | (FrameBase & {
      readonly kind: "ability";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly controllerId: PlayerId | null;
      readonly event: TriggerEvent | null;
      readonly eventFrameId: FrameId | null;
      /** What paying the ability's cost bound (chosen cards, X, paid resources). */
      readonly bindings: Bindings;
      readonly vars: Vars;
      /**
       * The ability's own payment is read for resource types and its wilds are not declared yet (`UndeclaredWilds`;
       * docs/phase7-wave8.md §3.62): the frame asks its controller (`declareWildTypes`) before the ability resolves
       * anything, records the answer in `vars` (`paid.as.<type>`) and drops this. Absent on every other ability.
       */
      readonly undeclaredWilds?: UndeclaredWilds;
      /**
       * A Special resolved by a `resolveSpecials` with `bind` (docs/phase7-wave5.md §3.7): when its effects finish, what
       * they bound goes back to that frame under `<prefix>.` ("If at least 1 Sandman card was discarded this way").
       */
      readonly returnBindingsTo?: { readonly frameId: FrameId; readonly prefix: string };
      /**
       * Vars on other frames that count this ability if it resolves (`EffectSpec resolveSpecials`): its `<bind>.count`,
       * and the attack in progress's `labeledResolvedVar("preparation")`. Its effects frame raises each by 1 as it
       * finishes, only if they changed the game (`Frame<"effects">.resolvedCount`).
       */
      readonly resolvedCounts?: readonly ResolvedCountVar[];
      /**
       * An attack- or thwart-labeled ability whose `characterWouldAct` event was pushed above this frame
       * (docs/phase7-wave10.md §3.21): `"asked"` once it has been, so it is announced once; `"replaced"` when an
       * interrupt replaced it ("discard this card instead"), so the ability resolves none of its effects.
       */
      readonly wouldAct?: "asked" | "replaced";
    })
  /** Runs an `EffectSpec` program with a cursor and slot bindings. */
  | (FrameBase & {
      readonly kind: "effects";
      readonly effects: readonly EffectSpec[];
      readonly cursor: number;
      readonly bindings: Bindings;
      readonly vars: Vars;
      /** "That player" inside `forEachPlayer`. */
      readonly scopedPlayerId: PlayerId | null;
      readonly selfInstanceId: InstanceId | null;
      readonly controllerId: PlayerId | null;
      readonly event: TriggerEvent | null;
      readonly eventFrameId: FrameId | null;
      /**
       * A branch (`chooseOne`'s chosen option, `if`'s taken branch): when it finishes, its bindings and vars are
       * written back to this frame, so an effect after the `chooseOne`/`if` reads "the card discarded this way"
       * whichever branch bound it (docs/phase7-wave4.md §3.43).
       */
      readonly returnBindingsTo?: FrameId;
      /**
       * With `returnBindingsTo`: the bindings go back under `<prefix>.`, each slot added to what is already there and
       * each var summed, so several Specials of one `resolveSpecials` report together (docs/phase7-wave5.md §3.7).
       */
      readonly returnBindingsPrefix?: string;
      /**
       * With `returnBindingsPrefix`: what this frame started with (a `forEachPlayer` `bind` pass inherits its ability's
       * vars and slots). Only the vars and slots it set or changed go back, so a var the ability held before the loop
       * is not handed back once per pass.
       */
      readonly returnChangedFrom?: { readonly vars: Vars; readonly bindings: Bindings };
      /**
       * An ability's effects whose resolution is read (`resolveAbility`): `from` is the game's digest as they began
       * (`gameFingerprint`). When they finish with the game changed, the ability resolved: each var in `to` (its
       * `Frame<"ability">.resolvedCounts`) goes up by 1, a Special is listed in `<prefix>.resolved` and
       * `abilityResolved` is announced; when nothing changed, none of them (RRG 1.8 "Resolve", p. 37). Absent when
       * nothing reads it, which reads as changed.
       */
      readonly resolvedCount?: { readonly from: string; readonly to: readonly ResolvedCountVar[] };
      /**
       * The effects of an ability a player uses: an ability on a player card, an action, or an optional interrupt or
       * response (not a forced ability, When Revealed, boost or setup on an encounter card). "Players cannot discard
       * attachments …" (Powerful Enchantments, `valk` 25030) reads it. docs/phase7-wave4.md §3.44.
       */
      readonly byPlayer?: true;
      /**
       * The effects of an ability (`resolveAbility`), which has resolved once they have (RRG 1.8 "Resolve", p. 37): as
       * this frame finishes it announces `abilityResolved` for that ability, carrying the slots the frame then holds
       * (`announceAbilityResolved`, docs/phase7-wave9.md §3.43 (c)). Absent on a branch and on effects that are not an
       * ability's own.
       */
      readonly announceResolved?: {
        readonly instanceId: InstanceId;
        readonly abilityId: AbilityId;
        readonly controllerId: PlayerId | null;
      };
      /** The setup instruction these effects resolve, when they are one (see `SetupInstructionSource`). */
      readonly instruction?: SetupInstructionSource;
      /**
       * These effects are an optional setup rule the players turned on (`ScenarioRules.setupOptions`): when the frame
       * finishes, the log says `setupOptionApplied` with what is kept here, so the entry follows the change it explains.
       */
      readonly setupOption?: {
        readonly option: string;
        readonly amount: number;
        readonly text: string;
        readonly citation: string;
      };
      /**
       * The ability whose effects these are, carried into its branches (`chooseOne`, `if`, `then`, …): an attack these
       * effects make names it as its `sourceAbilityId` ("When you use your 'Optic Blast' ability", Full Blast 33008;
       * docs/phase7-wave6.md §3.84). Absent for effects no ability resolves (a lasting effect's, a surge).
       */
      readonly abilityId?: AbilityId;
      /**
       * This frame is the step where a defeated card leaves play, after its When Defeated abilities (RRG 1.8 "When
       * Defeated Abilities", p. 48; `resolve/event.ts` `leaveAfterWhenDefeated`). While it waits, the card is still in
       * play at zero remaining hit points but already defeated, so the defeat sweep does not defeat it again.
       */
      readonly defeatedLeaving?: InstanceId;
      /**
       * With `defeatedLeaving`: the card whose ability defeated it ("defeat a minion", `EffectSpec defeat`), for the
       * Permanent keyword's same-set exception (RRG 1.8 "Permanent", p. 32; docs/phase7-wave5.md §4.1 Q46). Absent for
       * a defeat by the game's rules (zero hit points, zero threat). This frame's own `selfInstanceId` is the defeated
       * card, and is never the source of its leaving.
       */
      readonly defeatedLeavingSource?: CardId;
      /**
       * These effects replace this event ("… instead", `EffectSpec replaceTriggeringEvent`), carried into their `if`
       * branches. A `placeThreat` or `removeThreat` replacing an event of the same kind is still that threat ("that
       * threat is added here instead", Traffic Jam `fne` 60189; RRG 1.8 "Replacement Effect", p. 37): it keeps the
       * replaced event's source and parent frame, so the scheme activation or thwart it belonged to reports it
       * (`threatPlaced`, `threatRemoved`) and a scheme it defeats is defeated by that thwart's player.
       */
      readonly replacesEvent?: TriggerEvent;
      /** The one thwart this "(thwart)" ability is making, on the root frame of its resolution (`ThwartSession`). */
      readonly thwart?: ThwartSession;
      /**
       * On the root frame of an "(attack)"-labeled ability: the attack it begins as it begins resolving has been made
       * (`beginLabelAttack`, `resolve/attack-ability.ts`: the one attack of an ability with no `attack` effect,
       * `TriggerEvent attack.labeled`, or the attack an ability with an `attack` effect began before that instruction,
       * `attack.begun`), so no later instruction begins another that way, whether that attack is waiting beneath this
       * frame or was cancelled.
       */
      readonly labelAttackMade?: true;
      /**
       * On the root frame of an "(attack)"-labeled ability: an attack it made by its controller's identity was
       * cancelled (`cancelAbilityAttack`, `resolve/attack-ability.ts`), so nothing more of that attack resolves: the
       * ability's remaining damage instructions deal no enemy damage and its remaining `attack` effects are cancelled
       * with it (owner decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 65).
       */
      readonly attackCancelled?: true;
      /**
       * On the root frame of an "(attack)"-labeled ability: all damage of the attack it makes with its controller's
       * identity is prevented (`modifyAttack.preventAllDamage` in the window of one of its `attack` events, the frame
       * named here; `preventAbilityAttackDamage`, `resolve/attack-ability.ts`). The ability is one attack (RRG 1.8
       * "Attack (Player Ability Type)", p. 10), so the damage of its other `attack` events and of its damage
       * instructions is prevented too (owner decision, docs/phase7-wave9.md §4.1 Q4 = A).
       */
      readonly attackDamagePrevented?: FrameId;
      /**
       * On the root frame of an "(attack)"-labeled ability: the attack it makes with its controller's identity was
       * moved in the window of one of its `attack` events (`frameId`) off the enemy `from` onto `to` (`EffectSpec
       * retargetAttack` with `attack: "player"`; `retargetAbilityAttack`, `resolve/attack-ability.ts`). The ability
       * is one attack (RRG 1.8 "Attack (Player Ability Type)", p. 10), so `to` is its only target from then on: its
       * other `attack` events and the damage its instructions aim at other enemies are not dealt (owner decision,
       * docs/phase7-wave9.md §4.1 Q4 = A, provisional).
       */
      readonly attackRetargeted?: { readonly frameId: FrameId; readonly from: InstanceId; readonly to: InstanceId };
      /**
       * On the root frame of a labeled ability whose printed cost is written as its leading effects
       * (`AbilityDefinition.costEffects`), while that cost is being paid: how many of the frame's last instructions are
       * the ability's effect. RRG 1.8 "Initiating Abilities" (p. 24): costs are paid in step 5, effects resolve in step
       * 6; "Labeled Ability" (p. 26): the labeled effect is performed "when the labeled ability begins resolving (after
       * costs have been paid)". So the status cards that cancel the label are read, and an "(attack)" ability's attack
       * begins, only when the cursor reaches the effect (`beginEffectAfterCost`, `resolve/effects-frame.ts`; ruling
       * April 30, 2026 - Ruling 5). Counted from the end because a choice inserted while paying lands before the
       * effect. Absent once the cost is paid, and on every other frame.
       */
      readonly costEffectsPending?: number;
      /** With `costEffects`: the cursor at which the effect began, once the cost has been paid (step 6). */
      readonly effectBeganAt?: number;
    })
  /** RRG "Attack (Enemy Activation)" steps 1–5; step 6 is the event frame's response window. */
  | (FrameBase & {
      readonly kind: "enemyAttack";
      readonly enemyInstanceId: InstanceId;
      readonly attackedPlayerId: PlayerId;
      readonly targetPlayerId: PlayerId;
      readonly targetInstanceId: InstanceId;
      readonly defenderInstanceId: InstanceId | null;
      /** A defender declared in the Declare Defender step (DEF reduces damage); false for a "(defense)" ability. */
      readonly basicDefense: boolean;
      readonly boostIcons: number;
      readonly stage: "giveBoost" | "declareDefender" | "flipBoosts" | "dealDamage" | "done";
      /**
       * The Declare Defender step declared this character and its defense has an additional cost (`RuleSpec
       * additionalPowerCost`, docs/phase7-wave9.md §3.31): its controller is being asked to pay it, and it is not
       * exhausted or made the defender until they have.
       */
      readonly defenderCostFor?: InstanceId;
      /** The characters whose additional cost to defend went unpaid during this step; not offered again in it. */
      readonly defendersNotPaidFor?: readonly InstanceId[];
      /** The `enemyAttack` event frame this procedure belongs to. */
      readonly eventFrameId: FrameId | null;
      /** No boost card for this attack (`TriggerEvent.noBoost`). */
      readonly noBoost?: boolean;
      /**
       * An enemy attacking another enemy with a boost card (`enemyAttacksEnemy.boost`; Headpool, FFG ruling January 26,
       * 2026 (4)). `eventFrameId` is its `enemyAttacksEnemy` event frame, `attackedPlayerId` and `targetPlayerId` the
       * player who resolves the boost card, `targetInstanceId` the enemy attacked. There is no Declare Defender step.
       */
      readonly versusEnemy?: true;
      /**
       * How many boost cards the give-boost step has given so far, in a game where an ability hears each one
       * (`TriggerEvent boostCardGiven`, docs/phase7-wave9.md §3.44): the step is then taken one card at a time.
       * Absent in every other game, and once the step is over.
       */
      readonly boostsGiven?: number;
      readonly boost?: BoostInProgress | null;
      /**
       * The damage step has announced `TriggerEvent enemyAttackDamageStep`, so on its next run it deals the damage.
       * Absent in a game where nothing listens for that event (the step deals the damage on its first run).
       */
      readonly damageStepAnnounced?: true;
    })
  /** RRG "Scheme (Enemy Activation)". */
  | (FrameBase & {
      readonly kind: "enemyScheme";
      readonly enemyInstanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly boostIcons: number;
      readonly stage: "giveBoost" | "flipBoosts" | "placeThreat" | "done";
      readonly eventFrameId: FrameId | null;
      readonly noBoost?: boolean;
      /** As `Frame<"enemyAttack">.boostsGiven`. */
      readonly boostsGiven?: number;
      readonly boost?: BoostInProgress | null;
    })
  /**
   * RRG 1.8 "Villainous" (p. 47) on a character that is not an enemy (an ally or a hero: MC60 p. 26 FAQ, "The rules for
   * villainous have been revised to function for allies (and heroes) who have it"; docs/phase7-wave11-scenarios.md
   * §S3.7): "When resolving that basic power, turn the boost card faceup, resolve any boost ability on that card, and
   * apply its boost icons to the character's stats for this use. Discard the boost card after it is resolved."
   * `resolve/villainous.ts`. Two frames for one use of a basic power:
   *
   * - `use`, the record of the use, beneath the use's own frame (`useFrameId`): what the use turned up, the stat its
   *   icons go to, and the lasting modifiers carrying them. It runs once the use has resolved, and discards the cards
   *   (RRG 1.8 p. 47; MC60 p. 3, "after the basic power resolves").
   * - `resolve`, above the use, which turns each card up and resolves it, writing to its record (`recordFrameId`).
   */
  | (FrameBase & {
      readonly kind: "characterBoost";
      readonly stage: "use" | "resolve";
      readonly characterInstanceId: InstanceId;
      /** The character's controller: "you" for the Boost abilities (RRG 1.8 p. 47). */
      readonly playerId: PlayerId;
      readonly power: BasicPowerName;
      /**
       * `use`: the stat powering this use, its icons' destination (rewritten by `setBasicPowerStat`, as the events are,
       * and its `bonuses` with it). `resolve` reads its record's.
       */
      readonly stat: StatName;
      /** The frame the use is (`basicPowerUseFrameId`); its end ends the icons' modifiers. */
      readonly useFrameId: FrameId;
      /**
       * `use`: the facedown boost cards the character held before this use. They stay facedown: only the card this use
       * gave is resolved (RRG 1.8 "Boost, Boost Icon", p. 11).
       */
      readonly heldBefore: readonly InstanceId[];
      /** `use`: the cards turned faceup for this use, in order. */
      readonly turned: readonly InstanceId[];
      /** `use`: the lasting stat modifiers carrying their icons (`LastingEffect.id`). */
      readonly bonuses: readonly string[];
      /** `use`: its `resolve` frame has been pushed (a basic defense's waits for the enemy's boost cards). */
      readonly started?: true;
      /** `resolve`: its `use` record. */
      readonly recordFrameId?: FrameId;
      /** `resolve`: the card being resolved. */
      readonly boost?: BoostInProgress | null;
    })
  /** RRG "Reveal" steps 1–4. */
  | (FrameBase & {
      readonly kind: "reveal";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      /** "Cancel its When Revealed effects" (incite and surge are When Revealed effects too). */
      readonly whenRevealedCancelled: boolean;
      /** "Cancel the effects of that card and discard it": it is still revealed, nothing else happens. */
      readonly effectsCancelled: boolean;
      /** "This card gains surge" resolved while it was being revealed. */
      readonly surgeGained: boolean;
      /**
       * The card's surge resolved in step 3 among its other When Revealed abilities, because the first player ordered it
       * before a printed one (FFG ruling, September 22, 2026; `orderWhenRevealed`), so the `surge` stage has nothing
       * left to resolve. Absent on every other reveal.
       */
      readonly surgeResolved?: true;
      /**
       * Reveal step 3 initiated at least one of the card's When Revealed abilities, incite included (RRG 1.8 "Reveal",
       * p. 38), uncancelled. With a live surge, this is what makes a treachery "resolved" (RRG 1.8 "Resolve", p. 37;
       * `encounterCardResolved`). Absent until then.
       */
      readonly abilityResolved?: true;
      /**
       * Where the card was when its reveal began (the player's dealt encounter cards, or wherever `revealCard` found
       * it). A treachery or revealed event still there when the reveal finishes is discarded; one an effect already
       * moved ("Remove this card from the game", "shuffle it into the encounter deck") stays where it went
       * (docs/phase7-wave4.md §3.45).
       */
      readonly revealedFrom?: ZoneId | null;
      /**
       * Where the reveal was initiated, for "If this card was revealed from the encounter deck" (`Predicate
       * revealedFromEncounterDeck`; docs/phase7-wave6.md §3.64, §4 Q35): `encounterDeck` for a card revealed off an
       * encounter deck or dealt facedown from one; `elsewhere` for a scenario deck, the set-aside area, a search, a
       * discard pile or a player's deck. Absent (a frame saved before it existed) reads as `elsewhere`.
       */
      readonly source?: RevealSource;
      /**
       * A card already in play whose new face is revealed: a villain's flip or next stage (FAQ "Dial M for Mojo (#35)",
       * RRG 1.8 p. 64: "When Spiral flips, her new face is revealed"; docs/phase7-wave6.md §3.65, §4.1 Q36). It goes
       * through the whole reveal (the "when revealed" windows, incite, When Revealed, peril, surge) but never enters
       * play, is never discarded, and a cancelled one stays where it is. Absent on every other reveal.
       */
      readonly newFace?: true;
      /**
       * A card found faceup in play and revealed where it is ("find X and reveal it", `revealCard`; RRG 1.8 "Find",
       * p. 19; docs/phase7-wave8.md §3.1). It does not enter play: no `cardEntersPlay`, no starting threat, no unique
       * check, no teamwork, and it is never discarded by the reveal. A minion engages the revealing player unless it
       * already was engaged with them, keeping everything on it; any other card stays where it is (an attachment on
       * its host, §4.1 Q17). Then its When Revealed abilities and reveal keywords resolve (ruling June 25, 2026 (5)).
       * Absent on every other reveal.
       */
      readonly foundInPlay?: true;
      /** With `foundInPlay`: the minion engaged the revealing player by this reveal (it was not engaged with them). */
      readonly engagedByReveal?: true;
      /**
       * The card that holds this minion once it is revealed (`EffectSpec revealCard.heldBy`; docs/phase7-wave9.md §4.1
       * Q26): at the placement step the minion enters play attached to it as a held minion (`isHeldMinion`) instead
       * of engaged with `playerId`, so nothing that follows from an engagement happens. Absent on every other reveal.
       */
      readonly heldBy?: InstanceId;
      /**
       * "Reveal it, treating each [per player] on it as 1" (`EffectSpec revealCard.perPlayerAs`; docs/phase7-wave10-
       * hero-packs.md H3.5): while this frame is on the stack, every per player icon on `instanceId` multiplies by this
       * number (`perPlayerReading`, `query.ts`). Gone with the frame, so the reading covers the reveal and nothing
       * after it (the owner's answer to question 19 = A). Absent on every other reveal.
       */
      readonly perPlayerAs?: number;
      /**
       * With `stage: "uniqueCheck"`: the stage the reveal continues to when the card is let in. Legacy: no reveal sets
       * it any more (the check always goes on to `whenRevealed`); `"quickstrike"` is read only off a frame saved before
       * the reveal order of the owner's answer 30B (2026-10-12).
       */
      readonly afterUnique?: "quickstrike" | "whenRevealed";
      /**
       * The player this minion engaged by this reveal: the revealing player it entered play engaged with (RRG 1.8
       * "Reveal", p. 38, step 2), or the finder a minion found in play engaged because it was not already engaged
       * with them ("Find", p. 19). Its quickstrike and teamwork resolve once the reveal's steps are done (`keywords`),
       * and only while it is still in play: quickstrike only while it is still engaged with this player, teamwork
       * against whichever player it is engaged with by then (the owner's answer 36B). Absent on a held minion (`heldBy`), a
       * card that engaged nobody, and a frame saved after its `quickstrike` stage under the old order, whose keywords
       * have already resolved.
       */
      readonly engagedPlayerId?: PlayerId;
      /**
       * The conditions of every response window triggered while this card was being revealed, oldest first: incite's
       * and its When Revealed's threat, cards entering play (this one included), damage, status cards, draws and
       * discards. They wait for the end of the reveal (RRG 1.8 "Reveal", p. 38: "Responses (both forced and non-forced)
       * to any step of the revealing of an encounter card are not resolved until after all steps of the reveal process
       * have been completed"; owner decision 2026-10-16, audit finding 18, generalising the owner's answers 32B and 35B
       * of 2026-10-12) and share the window of the reveal's own `cardRevealed` announcement, after a minion's
       * quickstrike and teamwork (`resolve/reveal-hold.ts`).
       */
      readonly heldResponses?: readonly TriggerEvent[];
      /**
       * Characters that entered play with toughness while this card was being revealed, oldest first: each is given its
       * tough status card once the reveal's steps are done, before quickstrike and teamwork (RRG 1.8 "Toughness",
       * p. 45, a forced response to entering play; "Reveal", p. 38; owner decision 2026-10-16, audit finding 18,
       * superseding answer 33A).
       */
      readonly heldToughness?: readonly InstanceId[];
      /**
       * With `stage: "keywords"`: the engagement keywords still to resolve, in the order they resolve. Absent until the
       * order is known (a minion with both asks the first player, the owner's answer 34B).
       */
      readonly keywordOrder?: readonly RevealKeyword[];
      /**
       * The effects frame whose pre-"then" text this reveal is ("Reveal that minion, then give it a tough status
       * card"): if the card's effects are cancelled, that frame is marked unresolved (RRG 1.8 "'Then'", p. 44).
       */
      readonly preThenOf?: FrameId;
      /**
       * The card's attach instruction ability (`AbilityDefinition.attachInstruction`) has been resolved, so its When
       * Revealed is not what attaches it: the reveal skips `settleAttach`.
       */
      readonly attachInstructed?: true;
      /**
       * `attachInstruction`: an attachment whose "attach to" text is an ability (`AbilityDefinition.attachInstruction`,
       * docs/phase7-wave7.md §3.35) has resolved it; attached, it enters play now, and otherwise it is handled as an
       * attachment with no legal `attachesTo` host is (its `cannotAttach` abilities, or the discard).
       *
       * `cannotAttach`: an attachment with no legal host is resolving its own `cannotAttach` abilities instead of
       * being discarded; on return it enters play if they attached it, and is discarded otherwise.
       *
       * `settleAttach`: an attachment with no "attach to" text (`AttachmentCard.attachesTo` absent) has resolved its
       * When Revealed, which attaches it (RRG 1.8 "Reveal", p. 38; ruling, Feb 20, 2026 (4)): attached, it enters play
       * now; otherwise `finish` discards it like a treachery (RRG 1.8 "Attach To", p. 8).
       *
       * `uniqueCheck`: a minion, side scheme or environment has entered play and its enter-play window has resolved; it is
       * discarded if it still matches a card in play (RRG 1.8 "Unique Icon"), else the reveal goes on to `afterUnique`.
       *
       * `quickstrike`: legacy. Until the owner's answer 30B (2026-10-12) a minion's quickstrike and teamwork resolved
       * here, before its When Revealed (ruling, Feb 28, 2026 (4) answer 2). No reveal enters this stage any more; a
       * frame saved in it records whom the minion engaged (`engagedPlayerId`) and goes on to `whenRevealed`, so its
       * keywords resolve at `keywords` like any other reveal's.
       *
       * `surge`: the last of step 3. The card's incite and printed When Revealed abilities have resolved; its surge
       * keyword, printed or gained, resolves now as the When Revealed it is and deals its card facedown, to be revealed
       * later in the player's queue (RRG 1.8 "Surge", p. 42; owner decision 2026-10-16, audit finding 16).
       *
       * `finish`: steps 1 to 3 are done; step 4 discards a treachery (RRG 1.8 "Reveal", p. 38).
       *
       * `keywords`: every step of the reveal is done, and the minion's engagement keywords resolve, one at a time, each
       * read as it resolves: quickstrike (RRG 1.8 p. 36: "If a minion with the quickstrike keyword is being revealed,
       * the quickstrike keyword resolves after any 'When Revealed' abilities on that minion are resolved") and teamwork
       * (p. 43, the same sentence). Skipped when neither applies.
       *
       * `responses`: the keywords are done; the responses to the reveal are announced (`cardRevealed` with the held
       * responses, `encounterCardResolved`, `minionEngaged`). The surge's card was already dealt at `surge`.
       */
      readonly stage:
        | "faceup"
        | "enterPlay"
        | "attachInstruction"
        | "cannotAttach"
        | "uniqueCheck"
        | "quickstrike"
        | "whenRevealed"
        | "settleAttach"
        | "surge"
        | "finish"
        | "keywords"
        | "responses"
        | "done";
    })
  /** RRG "Initiating Abilities" steps 6–7, after costs are paid. */
  | (FrameBase & {
      readonly kind: "playCard";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      /** Who controls the card once it's in play ("Play under any player's control"); usually `playerId`. */
      readonly controllerId: PlayerId;
      readonly attachToInstanceId: InstanceId | null;
      /** `beingPlayed`: a non-event's play interrupt window has resolved; it enters play next unless cancelled. */
      readonly stage: "enterPlay" | "beingPlayed" | "effects" | "abilities" | "discardEvent" | "done";
      /**
       * RRG 1.8 "Cancel" (p. 11): a Forced Interrupt on `cardBeingPlayed` cancelled this card's effects
       * ("When you play an event, cancel its effects and discard it", Counterspell, `drs` pack). The card is still
       * considered played and is still discarded — only its own abilities are prevented from initiating. A cancelled
       * non-event never enters play (Spellcasting 57063): it goes from the table to its owner's discard pile.
       */
      readonly effectsCancelled: boolean;
      /**
       * The one ability of a played event that resolves (RRG 1.8 "Event", p. 18: "the player playing it chooses one of
       * those abilities to trigger"): the interrupt or response that matched the timing window it was played in, or
       * the Action ability its player triggered. Null for a card that is not an event.
       */
      readonly triggeredAbilityId: AbilityId | null;
      readonly event: TriggerEvent | null;
      readonly eventFrameId: FrameId | null;
      /** Cost results handed to the card's abilities (`paid.<type>`, discarded cards, …). */
      readonly bindings: Bindings;
      readonly vars: Vars;
      /** "It enters play exhausted" (`EffectSpec playFromHand.entersExhausted`; docs/phase7-wave6.md §3.57). */
      readonly entersExhausted?: true;
      /**
       * The in-play scenario area the card is played into instead of its controller's play area (`playCard.into`,
       * `RuleSpec playDestination`; docs/phase7-wave8.md §3.34). Absent on every other play.
       */
      readonly intoScenarioPlayArea?: string;
      /**
       * Where the card was played from, and whether it counts as played from the hand (`PlayOrigin`; RRG 1.8 FAQ
       * "Magik (#30A)", p. 64), carried by its `cardBeingPlayed` and `cardPlayed` trigger events. Absent (a frame built
       * before origins were recorded): from the hand.
       */
      readonly playedFrom?: { readonly from: PlayedFrom; readonly countsAsFrom?: "hand" };
      /**
       * Where a played event goes once its effects have resolved, when not its owner's discard pile (`EffectSpec
       * afterResolving`; docs/phase7-wave7.md §3.68): "return that event to your hand after resolving its effects".
       * Read once, by the `discardEvent` stage, and only for an event still being resolved whose effects were not
       * canceled.
       */
      readonly afterResolving?: "hand";
      /**
       * The play's payment is read for resource types and its wilds are not declared yet (`UndeclaredWilds`): the
       * frame asks its player (`declareWildTypes`) before the card does anything, records the answer in `vars`
       * (`paid.as.<type>`) and drops this. Absent on every other play.
       */
      readonly undeclaredWilds?: UndeclaredWilds;
    });

export type StackFrameKind = StackFrame["kind"];

/**
 * What was paid to play a card, while its play is still resolving (its `playCard` frame is on the stack): the
 * `paid.*` vars, with `overpaid.*` and a chosen `x`. RRG 1.8 "Cost" (p. 13): the resources spent to play a card are
 * "paid for that card", so "if you paid for this card using a [energy] resource" is a fact about that card's play.
 *
 * Scoped to the play in progress, not to the card for as long as it stays in play: every "if you paid for …" card in
 * the pool so far reads it while the card is being played — its own abilities (Valkyrie, seeded by `abilityFrame`), or
 * another card's interrupt to that play ("When you play an Aggression Attack event, if you paid for that event using a
 * [mental] resource", Honed Technique 28017, via `Predicate` `paidWith.of`). A card put into play without being played
 * has no `playCard` frame, so it reads as paid with nothing.
 */
export function playPaymentVars(stack: readonly StackFrame[], instanceId: InstanceId): Vars {
  const play = stack.find((frame) => frame.kind === "playCard" && frame.instanceId === instanceId);
  if (play?.kind !== "playCard") return {};
  return paymentVarsIn(play.vars);
}

/**
 * The payment among a play frame's vars: `paid.*`, and `overpaid.*` and a chosen `x`, which travel the same way ("for
 * each resource you overpaid", Ant-Man ally; docs/phase7-wave2.md §3.8). What `playPaymentVars` hands a reader while
 * the play resolves and what the play's `cardPlayed` event carries afterward (`TriggerEvent cardPlayed.payment`).
 */
export function paymentVarsIn(vars: Vars): Vars {
  return Object.fromEntries(
    Object.entries(vars).filter(([key]) => key.startsWith("paid.") || key.startsWith("overpaid.") || key === "x"),
  );
}

/**
 * The slot holding the cards that paid for a play (docs/phase7-wave9.md §3.46 (b)): "tuck 1 card used to pay for her
 * under her" (Spectrum, `falcon` 53018). The cards spent as cards to pay for the play, in payment order: the cards
 * discarded from a hand (the paying player's, or another player's for an alliance card) and a tucked card spent "as if
 * it were in their hand" (`RuleSpec spendableFromTucked`, §3.46 (c)). They are the same cards `paid.cards.<cardType>`
 * counts, judged the same way (`cardsThatPaid` in `actions.ts`):
 *
 * - RRG 1.8 "Cost" (p. 13): resources come "by discarding cards from their hand or by using 'Resource' card
 *   abilities". A resource ability generates a resource and is no card that paid, whatever card carries it; the card a
 *   resource ability's own cost exhausts or discards is that ability's cost, not the play's.
 * - RRG 1.8 "Cost" (p. 13): resources "generated beyond the specified cost … were not paid for that cost", so a card
 *   whose every resource was overpaid is left out, and at a cost of 0 no card paid (docs/phase7-wave8.md §4.1 Q28 = A).
 *
 * Bound on the play's frame (`playFrameCost`), so the played card's own abilities read it while the play resolves
 * (`playPaidCards`, an event's ability through the frame's bindings), and carried by the play's `cardBeingPlayed` and
 * `cardPlayed` events to the abilities that answer them (`carriedByEvent`). Absent when no card paid: a play paid by
 * resource abilities alone, a free play, a card put into play without being played. The slot holds instance ids; a
 * reader finds each card where it is now (a discard pile, or wherever an answer to its spending moved it).
 */
export const PAID_CARDS_SLOT = "paid.cards";

/**
 * The cards that paid for the play of `instanceId` while that play is still resolving, as the bindings its own
 * abilities start with (`PAID_CARDS_SLOT`); empty when none did or the card is not being played. The slot twin of
 * `playPaymentVars`.
 */
export function playPaidCards(stack: readonly StackFrame[], instanceId: InstanceId): Bindings {
  const paid = playFrameOf(stack, instanceId)?.bindings[PAID_CARDS_SLOT];
  return paid && paid.length > 0 ? { [PAID_CARDS_SLOT]: paid } : {};
}

/** The var prefix of the paid resources by the type each was used as (`paid.as.<type>`; docs/phase7-wave8.md §3.62). */
export const PAID_AS_PREFIX = "paid.as.";

/**
 * Paid resources by the type each was used as (`paidAsDeclared`), as the vars a reader reads: `paid.as.<type>` for each
 * type with at least one. A type with none has no var, as `paid.cards.<cardType>` has it.
 */
export function paidAsVars(paid: ResourcePool): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const type of RESOURCE_TYPES) if (paid[type] > 0) vars[`${PAID_AS_PREFIX}${type}`] = paid[type];
  return vars;
}

/**
 * The play of `instanceId` still resolving: its innermost `playCard` frame, or undefined when the card is not being
 * played. The record of how the card is being played lives here and ends with it: `PLAYED_VIA_SLOT` in its bindings
 * (`playFromHand.via`, docs/phase7-wave6.md §3.42) and the `PLAY_NOTE_PREFIX` vars an interrupt to the play writes
 * (`modifyCardEffect.note`, §3.52: "If Gambit's 'Throw de Card' ability removed at least …").
 */
export function playFrameOf(
  stack: readonly StackFrame[],
  instanceId: InstanceId,
): Extract<StackFrame, { kind: "playCard" }> | undefined {
  const play = stack.find((frame) => frame.kind === "playCard" && frame.instanceId === instanceId);
  return play?.kind === "playCard" ? play : undefined;
}

/** The var prefix of a play's notes (`modifyCardEffect.note`, `Predicate playNote`; docs/phase7-wave6.md §3.52). */
export const PLAY_NOTE_PREFIX = "note.";

/**
 * The ability or card a payment paid for (`applyRuleUntil` `"endOfPaidFor"`, docs/phase7-wave6.md §3.30): the topmost
 * `ability` / `playCard` frame for `instanceId` (slot `paidFor`). It is pushed before the payment is announced, so a
 * resource ability's effects resolve above it.
 */
export function paidForFrameId(stack: readonly StackFrame[], instanceId: InstanceId | null): FrameId | null {
  if (!instanceId) return null;
  const frame = stack.find((f) => (f.kind === "ability" || f.kind === "playCard") && f.instanceId === instanceId);
  return frame?.frameId ?? null;
}

/**
 * The names of an attack frame's vars that record what `modifyAttack { preventAllDamage, bind }` stopped
 * (docs/phase7-wave9.md §3.4; `EffectSpec modifyAttack.bind`), which are that attack's results once it resolves.
 */
export const attackPreventedVars = (
  bind: string,
): { readonly prevented: string; readonly amount: string; readonly total: string } => ({
  prevented: `${bind}.prevented`,
  amount: `${bind}.amount`,
  total: `${bind}.total`,
});

/**
 * The event frame of the attack or activation currently resolving ("this
 * attack", "this activation"): the topmost `attack` / `enemyAttack` /
 * `enemyScheme` event on the stack.
 */
export function currentActivationFrameId(stack: readonly StackFrame[]): FrameId | null {
  for (const frame of stack) {
    if (frame.kind !== "event") continue;
    // An "(attack)" ability's attack waiting for the rest of its ability (`attackWaiting`) has dealt its damage: the
    // ability's later instructions name what they named before it waited, the activation around it if there is one.
    // The flag is cleared as the attack starts to finish, so its retaliate and "after … attacks" abilities name it.
    if (frame.attackWaiting) continue;
    const kind = frame.event.kind;
    // `enemyAttacksEnemy` is an attack, so "this attack" names it, though not an activation (docs/phase7-wave3.md §3.23).
    if (
      kind === "attack" ||
      kind === "enemyAttack" ||
      kind === "enemyScheme" ||
      kind === "thwart" ||
      kind === "enemyAttacksEnemy"
    )
      return frame.frameId;
  }
  return null;
}

/**
 * The frame a basic power's use is, "for this use" (docs/phase7-wave2.md §17.4): its own `attack` / `thwart` event, or
 * the enemy attack a basic defense answers (`currentActivationFrameId`), on the stack beneath the power's
 * `basicPowerUsing` window. A basic recovery is neither an attack nor an activation: its use is its own `basicRecovery`
 * event (docs/phase7-wave6.md §3.40), which reads REC as it applies, never an attack further down.
 */
export function basicPowerUseFrameId(
  stack: readonly StackFrame[],
  power: BasicPowerName,
  characterId: InstanceId,
): FrameId | null {
  if (power !== "recover") return currentActivationFrameId(stack);
  const recovery = stack.find(
    (f) => f.kind === "event" && f.event.kind === "basicRecovery" && f.event.characterInstanceId === characterId,
  );
  return recovery?.frameId ?? null;
}

/**
 * The innermost thwart on the stack (`EffectSpec atEndOfThwart`, docs/phase7-wave11-hero-packs.md H3.12), or null:
 * "that thwart" for an interrupt or response answering it, the thwart around them for an effect resolving inside it.
 */
export function currentThwartFrameId(stack: readonly StackFrame[]): FrameId | null {
  const frame = stack.find((f) => f.kind === "event" && f.event.kind === "thwart");
  return frame?.frameId ?? null;
}

/** A client-facing summary of what is resolving and what is queued. */
export interface StackView {
  readonly frameId: FrameId;
  readonly kind: StackFrameKind;
  readonly description: string;
}

export function describeFrame(frame: StackFrame): string {
  switch (frame.kind) {
    case "event":
      return `${frame.event.kind} (${frame.stage})`;
    case "window":
      return `${frame.timing} window for ${frame.event.kind}`;
    case "ability":
      return `ability ${frame.abilityId} on ${frame.instanceId}`;
    case "effects":
      return `effects ${frame.cursor}/${frame.effects.length}`;
    case "enemyAttack":
      return `enemy attack by ${frame.enemyInstanceId} (${frame.stage})`;
    case "enemyScheme":
      return `enemy scheme by ${frame.enemyInstanceId} (${frame.stage})`;
    case "reveal":
      return `reveal ${frame.instanceId} (${frame.stage})`;
    case "playCard":
      return `play ${frame.instanceId} (${frame.stage})`;
    case "damageGroup":
      return `simultaneous damage to ${frame.members.length} character(s) (${frame.stage})`;
    case "characterBoost":
      return `villainous boost ${frame.stage} for ${frame.characterInstanceId}'s ${frame.power}`;
  }
}

export const viewStack = (stack: readonly StackFrame[]): readonly StackView[] =>
  stack.map((frame) => ({ frameId: frame.frameId, kind: frame.kind, description: describeFrame(frame) }));
