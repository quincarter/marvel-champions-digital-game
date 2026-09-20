import type { Trait } from "@mc/content";
import type { RuleSpec } from "./abilities.js";
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
  /** "Until the end of this turn" / "this turn": the active player's turn (docs/phase7-wave2.md §13). */
  | { readonly kind: "endOfTurn" }
  /** "Until the end of this attack/activation": ends when that event frame finishes. */
  | { readonly kind: "endOfEvent"; readonly frameId: FrameId }
  /**
   * While one card resolves: "increase the amount of damage *that event* deals by 2" (Embiggen!) lasts exactly as
   * long as that event card's play, so a card returned to hand and replayed does not keep the bonus. Ends when that
   * card's `playCard` frame finishes.
   */
  | { readonly kind: "endOfCardResolution"; readonly instanceId: InstanceId }
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
  | { readonly kind: "endOfPlayerTurn"; readonly playerId: PlayerId; readonly skipRound?: number };

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
  | { readonly kind: "costReduction"; readonly playerId: PlayerId; readonly amount: number; readonly cardFilter?: TargetQuery }
  /** "Until the end of the phase, X gets +N STAT". `amount` is re-evaluated on every read. */
  | (LastingReach & {
      readonly kind: "statModifier";
      readonly stat: StatName | "hp" | "handSize";
      readonly amount: ValueSpec;
      readonly scope: LastingScope;
    })
  /** "Gain the [trait] trait until the end of the phase". */
  | (LastingReach & { readonly kind: "traitGrant"; readonly trait: Trait; readonly scope: LastingScope })
  /** "Treat this card's printed text box as if it were blank" (`textBoxBlank`). */
  | { readonly kind: "blankTextBox"; readonly targets: readonly InstanceId[] }
  /** A delayed effect ("At the end of the round, …"): fires when its duration ends. */
  | { readonly kind: "delayedEffects"; readonly effects: readonly EffectSpec[]; readonly scope: LastingScope }
  /**
   * "Increase the amount of damage that event deals by 2" (Embiggen!) / "…threat that event removes…" (Shrink): a
   * bonus on one card, added to every instance of damage dealt (or threat removed) by that card's own effects while
   * it resolves (RRG 1.8 "Event", p. 19; FAQ #10/#11, p. 59).
   */
  | { readonly kind: "cardEffectBonus"; readonly sourceInstanceId: InstanceId; readonly damage: number; readonly threatRemoved: number }
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
  | { readonly kind: "ruleGrant"; readonly rule: RuleSpec; readonly scope: LastingScope };

export type LastingEffect = LastingEffectBody & {
  readonly id: string;
  readonly duration: LastingDuration;
};
