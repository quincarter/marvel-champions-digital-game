import type { AbilityId, CardId } from "@mc/content";
import type { AbilitySource } from "./abilities.js";
import type { CostChoices } from "./commands.js";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import { RESOURCE_TYPES, type ResolvedRequirement, type ResourcePool, type TypedResource } from "./resources.js";
import type { EffectSpec } from "./spec.js";
import type { TriggerEvent } from "./trigger-events.js";
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
 * The boost card an activation is resolving (RRG 1.8 "Boost", p. 11): `window` while its `boostCardTurnedFaceup` event
 * resolves, `ability` while its "Boost" ability resolves. Its icons are added and it is discarded after that.
 */
export interface BoostInProgress {
  readonly instanceId: InstanceId;
  /**
   * `count`: its icons are about to be counted (`boostIconsCounting`; docs/phase7-wave2.md §3.6). `resolved`: counted
   * (`icons`), its `boostCardResolved` response window open before the discard (docs/phase7-wave5.md §3.5).
   */
  readonly step: "window" | "ability" | "count" | "resolved";
  /** With `step: "resolved"`: the icons it adds. */
  readonly icons?: number;
  readonly iconsCancelled: boolean;
  readonly abilityCancelled: boolean;
  /**
   * Its boost icons and "Boost" ability are ignored (`RuleSpec ignoreBoost`, docs/phase7-wave7.md §3.67): it adds 0
   * and its ability does not resolve, neither being canceled. Set when the rule is first seen to cover the card.
   */
  readonly ignored?: true;
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
 */
export interface UndeclaredWilds {
  readonly pool: ResourcePool;
  readonly requirement: ResolvedRequirement;
  readonly only?: readonly TypedResource[];
}

interface FrameBase {
  readonly frameId: FrameId;
  /** Selections fed back by `resolveChoice`; the frame reads and clears it. */
  readonly answer: readonly string[] | null;
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
      /** "At the end of this attack" effects, run after the response window. */
      readonly endEffects: readonly DeferredEffects[];
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
       * end of this attack". While it waits it is not "this attack" to `currentActivationFrameId`.
       */
      readonly attackWaiting?: true;
      /**
       * With `attackOf`: the enemies this attack has attacked so far, one `characterAttacked` each (its own target,
       * then every enemy a later instruction of the ability targeted), pushed when the attack finishes. An enemy
       * named twice is attacked once. Only an instruction's own targets are added: an enemy that merely took damage
       * from the attack (an overkill spill) is not attacked (owner ruling Q50; `resolve/attack-ability.ts`).
       */
      readonly attacked?: readonly Extract<TriggerEvent, { kind: "characterAttacked" }>[];
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
       * Interrupt windows only: the optional abilities that were live as the window opened and listen for this kind
       * of event (`hearersOf`), by key, whether or not their whole condition was met then. One of them whose
       * condition comes to be met while the window is open, before the event resolves, is offered then ("When you
       * make a basic attack against an enemy with an upgrade attached", after another interrupt attached one): RRG 1.8
       * "Interrupt" (p. 25), the triggering condition is still imminent, and "Initiating Abilities" (p. 24), an ability
       * is checked as it is initiated. An ability that was not live at the open is never in this list, so the rule of
       * `optionalAtOpen` stands for it. Offered ones join `optionalAtOpen`, so none is offered twice.
       */
      readonly heardAtOpen?: readonly string[];
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
       * The effects of an ability a player uses: an ability on a player card, an action, or an optional interrupt or
       * response (not a forced ability, When Revealed, boost or setup on an encounter card). "Players cannot discard
       * attachments …" (Powerful Enchantments, `valk` 25030) reads it. docs/phase7-wave4.md §3.44.
       */
      readonly byPlayer?: true;
      /** The setup instruction these effects resolve, when they are one (see `SetupInstructionSource`). */
      readonly instruction?: SetupInstructionSource;
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
      /** The one thwart this "(thwart)" ability is making, on the root frame of its resolution (`ThwartSession`). */
      readonly thwart?: ThwartSession;
      /**
       * On the root frame of an "(attack)"-labeled ability with no `attack` effect: the ability's one attack has been
       * made (`TriggerEvent attack.labeled`, `resolve/attack-ability.ts`), so no later damage instruction makes
       * another, whether that attack is waiting beneath this frame or was cancelled.
       */
      readonly labelAttackMade?: true;
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
      /** The `enemyAttack` event frame this procedure belongs to. */
      readonly eventFrameId: FrameId | null;
      /** No boost card for this attack (`TriggerEvent.noBoost`). */
      readonly noBoost?: boolean;
      readonly boost?: BoostInProgress | null;
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
      /** With `stage: "uniqueCheck"`: the stage the reveal continues to when the card is let in. */
      readonly afterUnique?: "quickstrike" | "whenRevealed";
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
       * `quickstrike`: a minion has entered play engaged with its player (its enter-play window has resolved), and its
       * quickstrike attack comes next, before its When Revealed (ruling, Feb 28, 2026 (4) answer 2).
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
        | "finish"
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
      readonly stage: "enterPlay" | "effects" | "abilities" | "discardEvent" | "done";
      /**
       * RRG 1.8 "Cancel" (p. 13): a Forced Interrupt on `cardBeingPlayed` cancelled this card's effects
       * ("When you play an event, cancel its effects and discard it", Counterspell, `drs` pack). The card is still
       * considered played and is still discarded — only its own abilities are prevented from initiating.
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
 * The event frame of the attack or activation currently resolving ("this
 * attack", "this activation"): the topmost `attack` / `enemyAttack` /
 * `enemyScheme` event on the stack.
 */
export function currentActivationFrameId(stack: readonly StackFrame[]): FrameId | null {
  for (const frame of stack) {
    if (frame.kind !== "event") continue;
    // An "(attack)" ability's attack waiting for the rest of its ability (`attackWaiting`) has dealt its damage: the
    // ability's later instructions name what they named before it waited, the activation around it if there is one.
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
  }
}

export const viewStack = (stack: readonly StackFrame[]): readonly StackView[] =>
  stack.map((frame) => ({ frameId: frame.frameId, kind: frame.kind, description: describeFrame(frame) }));
