import type { CardId, KeywordInstance, Trait } from "@mc/content";
import type { EventPattern, RuleSpec } from "./abilities.js";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import type { EffectSpec, StatName, TargetQuery, ValueSpec } from "./spec.js";
import type { Bindings, Vars } from "./stack.js";

/**
 * Lasting effects (RRG "Lasting Effects"): an effect that persists for a
 * duration after the ability that created it has resolved. They live in
 * `GameState.lastingEffects` as plain data, are treated like constant
 * abilities while active (the modifier layer reads them on every check), and
 * are removed when their duration ends (or, for "next card" effects, when used).
 */
export type LastingDuration =
  /** "Until the end of the phase" / "this phase". */
  | { readonly kind: "endOfPhase" }
  /** "Until the end of the round" / "this round". */
  | { readonly kind: "endOfRound" }
  /**
   * "Until the next villain phase begins" (Pestilence, `aoa` 45083; docs/phase7-wave8.md §3.13): ends as the villain
   * phase starts, whichever phase it was made in. It lasts through the end of the round it was made in when that was a
   * villain phase, and through the whole player phase after it. RRG 1.8 "Lasting Effects" (p. 26): "A lasting effect
   * expires as soon as the timing point specified by its duration is reached", so it is gone before anything answers
   * the villain phase beginning and before step one (`expireNextVillainPhaseEffects`).
   */
  | { readonly kind: "nextVillainPhaseBegins" }
  /** "Until the end of this turn" / "this turn": the active player's turn (docs/phase7-wave2.md §13). */
  | { readonly kind: "endOfTurn" }
  /** "Until the end of this attack/activation": ends when that event frame finishes. */
  | { readonly kind: "endOfEvent"; readonly frameId: FrameId }
  /**
   * "Until after that attack resolves", before the attack exists (`applyRuleUntil` with `attack: "initiated"`,
   * spec.ts): waits on the effects frame `frameId`. That frame's next `enemyAttack` retimes it to `endOfEvent` on the
   * attack it initiates; if that initiates no attack, or the frame finishes first, it ends.
   */
  | { readonly kind: "awaitingAttack"; readonly frameId: FrameId }
  /**
   * While one card resolves: "increase the amount of damage *that event* deals by 2" (Embiggen!) lasts exactly as
   * long as that event card's play, so a card returned to hand and replayed does not keep the bonus. Ends when that
   * card's `playCard` frame finishes.
   */
  | { readonly kind: "endOfCardResolution"; readonly instanceId: InstanceId }
  /**
   * "Generate a resource for your 'Optic Blast' ability. **That attack** gains piercing and ranged" (Ruby Quartz Visor
   * 33003; docs/phase7-wave6.md §3.30): a resource ability's effect that lasts while the ability or card its payment
   * paid for resolves (`applyRuleUntil` with `until: "endOfPaidFor"`). `frameId` is that `ability` or `playCard`
   * frame, found on the stack beneath the payment; an `ability` frame hands its effects to an effects frame and is
   * popped, so as it resolves the effect is retimed to that effects frame (`lastingEffectRetimed`). It ends when that
   * frame finishes — or at once if the ability is not initiated — so a later use of the same ability is untouched.
   */
  | { readonly kind: "endOfPaidFor"; readonly frameId: FrameId }
  /**
   * **No time bound at all**: "The next event you play costs 3 additional resources. Discard this obligation after
   * you play an event." (Physical Toll, `drs` pack). It ends when `playerId` finishes playing a card `cardFilter`
   * matches — never at a phase or round boundary, however many rounds that takes.
   *
   * RRG 1.8 "Lasting Effects" (p. 26): "A lasting effect expires as soon as the timing point specified by its
   * duration is reached" — a card that specifies no timing point reaches none, and the same page says the effect
   * "continues to affect the game … whether or not the card that created the lasting effect is in play". A
   * `delayedEffects` body with this duration is the "after you play an event, <do this>" half; it fires when the
   * duration ends, like every other delayed effect.
   */
  | { readonly kind: "untilCardPlayed"; readonly playerId: PlayerId; readonly cardFilter?: TargetQuery }
  /**
   * **"Until your next turn ends"** (Care for Cassie `ant` 12025, Need for Speed `qsv` 14024; docs/phase7-wave2.md
   * §22): it ends when `playerId` finishes the first turn they *begin* after the effect was created. Distinct from
   * `endOfTurn`, which is the turn already in progress and cannot be created outside one (§13.3).
   *
   * `skipRound` is the round whose turn of theirs does not count, set only when the effect is created during that
   * player's own turn — a turn already under way is not their "next" one. A player takes exactly one turn per round
   * (RRG 1.8 "Player Phase", p. 34), so a round number names that turn uniquely and nothing has to be mutated as
   * rounds pass. A player who never takes another turn (eliminated) never reaches the timing point, which is what
   * RRG 1.8 "Lasting Effects" (p. 26) says happens: the effect expires "as soon as the timing point specified by its
   * duration is reached", and theirs never is.
   */
  | { readonly kind: "endOfPlayerTurn"; readonly playerId: PlayerId; readonly skipRound?: number }
  /**
   * "For its next basic thwart or attack action this phase" (Psychic Kicker, `phoenix` 34034; docs/phase7-wave6.md
   * §3.39, §4.1 Q23; spec.ts `NextBasicPowerUntil`): waiting on the next basic power among `powers` that one of
   * `characterIds` uses. While it waits the effect does nothing (`lastingEffectWaiting`). That power's event frame
   * retimes it to `endOfEvent` (`lastingEffectRetimed`), so it applies to that use only and ends as the use finishes.
   * Ends at the end of the phase if no such power comes; a stunned attack or confused thwart is cancelled before the
   * power is used, so it keeps waiting.
   */
  | {
      readonly kind: "nextBasicPower";
      readonly characterIds: readonly InstanceId[];
      readonly powers: readonly ("attack" | "thwart")[];
    };

/** A lasting effect that has not started to apply: `nextBasicPower` waiting on its power. */
export const lastingEffectWaiting = (duration: LastingDuration): boolean => duration.kind === "nextBasicPower";

/** The context a lasting effect evaluates its values and queries in (the ability that created it). */
export interface LastingScope {
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly vars: Vars;
  readonly bindings: Bindings;
}

/**
 * Which cards a lasting effect touches: the fixed cards chosen when it was
 * created (`targets`), or everything matching `affects` right now — a card
 * that starts matching later is affected too (RRG "Lasting Effects").
 */
export interface LastingReach {
  readonly targets: readonly InstanceId[] | null;
  readonly affects: TargetQuery | null;
}

/** What a lasting effect does. Extend this union for new lasting mechanics. */
export type LastingEffectBody =
  /**
   * "Reduce the resource cost of the next card that player plays by N" — consumed by that player's next played
   * card. `cardFilter` narrows which card consumes it: "the next Avenger ally played this phase" (Avengers Tower,
   * `cap` pack) leaves the reduction waiting through any other card that player plays first. Absent = any card
   * (Helicarrier's unfiltered "the next card").
   *
   * `amount` is **signed**: positive reduces, negative increases ("the next event you play costs 3 additional
   * resources" — Physical Toll, `drs` pack — is `amount: -3`). The pricing path floors the result at 0 either way.
   */
  | {
      readonly kind: "costReduction";
      readonly playerId: PlayerId;
      readonly amount: number;
      readonly cardFilter?: TargetQuery;
    }
  /** "Until the end of the phase, X gets +N STAT". `amount` is re-evaluated on every read. */
  | (LastingReach & {
      readonly kind: "statModifier";
      readonly stat: StatName | "hp" | "handSize";
      readonly amount: ValueSpec;
      readonly scope: LastingScope;
    })
  /**
   * "Gain the [trait] trait until the end of the phase" (`trait`), or "you gain each of the attached character's TRAITS
   * until the end of the round" (`copiedFrom`, Rogue's Skin Contact and Energy Transfer, `rogue` 38001a / 38007;
   * docs/phase7-wave6.md §3.50): the reached cards gain every trait the `copiedFrom` characters have **at the time of
   * each read**, printed and granted (`traitsOf`), never their keywords or text. Owner decision §4.1 Q28: "Rogue's copied
   * traits are live, for as long as Touched stays on that character", so the copy follows the host's trait changes and
   * is paired with `LastingEffect.whileAttached`. A `copiedFrom` card that has left play gives nothing.
   */
  | (LastingReach & { readonly kind: "traitGrant"; readonly scope: LastingScope } & (
        | { readonly trait: Trait; readonly copiedFrom?: undefined }
        | { readonly trait?: undefined; readonly copiedFrom: readonly InstanceId[] }
      ))
  /** "She gains retaliate 1 until the end of the phase" (docs/phase7-wave4.md §3.39). */
  | (LastingReach & { readonly kind: "keywordGrant"; readonly keyword: KeywordInstance; readonly scope: LastingScope })
  /**
   * "Treat this card's printed text box as if it were blank" (`textBoxBlank`). `sourceCardId` is the card whose effect
   * made the blank (the resolving ability's own card), which the Permanent keyword's protection compares sets with
   * (RRG 1.8 "Permanent", p. 32; `select.ts` `permanentProtectsFrom`, docs/phase7-wave5.md §4.1 Q31). Absent on a blank
   * made before it was recorded (an older save) or with no card behind it: such a blank reaches a permanent card as it
   * always did.
   */
  | { readonly kind: "blankTextBox"; readonly targets: readonly InstanceId[]; readonly sourceCardId?: CardId }
  /** A delayed effect ("At the end of the round, …"): fires when its duration ends. */
  | { readonly kind: "delayedEffects"; readonly effects: readonly EffectSpec[]; readonly scope: LastingScope }
  /**
   * "Increase the amount of damage that event deals by 2" (Embiggen!) / "…threat that event removes…" (Shrink): a
   * bonus on one card, added to every instance of damage dealt (or threat removed) by that card's own effects while
   * it resolves (RRG 1.8 "Event", p. 19; FAQ #10/#11, p. 59).
   */
  | {
      readonly kind: "cardEffectBonus";
      readonly sourceInstanceId: InstanceId;
      readonly damage: number;
      readonly threatRemoved: number;
    }
  /**
   * A `RuleSpec` with a clock on it: "**You cannot change form** until your next turn ends" (Care for Cassie),
   * "**You cannot ready your identity** until your next turn ends" (Need for Speed). docs/phase7-wave2.md §22.
   *
   * The same `RuleSpec` union a constant ability's `rules` carries, so a restriction is written once and works the
   * same whether a card in play imposes it or a lasting effect does — `activeRules` (`rules.ts`) reads both. That
   * matters because these two obligations **discard themselves** as they resolve, so there is no card left in play
   * to hold a constant rule (RRG 1.8 "Lasting Effects", p. 26: a lasting effect "continues to affect the game …
   * whether or not the card that created the lasting effect is in play").
   *
   * `scope` is the creating ability's, so the rule's `player`/`target` read "you" as that ability's controller even
   * though its card is gone.
   */
  | { readonly kind: "ruleGrant"; readonly rule: RuleSpec; readonly scope: LastingScope }
  /**
   * "Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of damage to an enemy."
   * (Schadenfreude, `gmw` 16032): every event matching `on` while this lasts resolves `effects`, automatically, after the
   * event and before its responses — a delayed effect that repeats (RRG 1.8 "Delayed Effect", p. 15: delayed effects
   * "resolve automatically and immediately after their specified timing point … and before responses", and are "not
   * treated as a new triggered ability"). `on` is matched with the scope's card as "self" and its controller as "you".
   * docs/phase7-wave3.md §3.17.
   */
  | {
      readonly kind: "eachTime";
      readonly on: EventPattern;
      readonly effects: readonly EffectSpec[];
      readonly scope: LastingScope;
    };

/**
 * "For as long as Touched stays on that character" (docs/phase7-wave6.md §3.50, §4.1 Q28): a second, earlier end for a
 * lasting effect besides its duration. The effect applies only while `card` is attached to `host`, and ends (reason
 * `"detached"`) once it is not — Touched moved to another host, set aside, or discarded with its host — so a later
 * attachment to the same host does not revive it. Checked on every read (`lastingReaches`) and swept between frames
 * (`resolve/state-checks.ts`), so the state shows the end.
 */
export interface AttachmentBound {
  readonly card: InstanceId;
  readonly host: InstanceId;
}

export type LastingEffect = LastingEffectBody & {
  readonly id: string;
  readonly duration: LastingDuration;
  readonly whileAttached?: AttachmentBound;
};
