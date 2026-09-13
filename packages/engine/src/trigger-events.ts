import type { AbilityId } from "@mc/content";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import type { Vars } from "./stack.js";

/**
 * Something that happens in the game and that abilities can hook. Every one of
 * these gets an `interrupt` window before it and a `response` window after it
 * when it resolves through the stack (RRG "Ability: Simultaneous Timing
 * Priority").
 */
export type TriggerEventBody =
  | {
      readonly kind: "dealDamage";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      /** Damage from an attack; defense, retaliate and overkill key off this. */
      readonly fromAttack: boolean;
      /** The attack/activation event frame this damage belongs to; damage/defeat results are reported there. */
      readonly parentFrameId?: FrameId | null;
      /** This attack has overkill even if its source lacks the keyword (Relentless Assault, Charge). */
      readonly overkill?: boolean;
      /** "This damage ignores tough status cards" (Lightning Strike, errata RRG 1.8 p. 65): taken through a tough status card, which stays. */
      readonly ignoreTough?: boolean;
      /** The card whose ability produced this damage when that isn't the source ("damage from Black Panther upgrades"). */
      readonly viaInstanceId?: InstanceId | null;
    }
  | { readonly kind: "healDamage"; readonly targetInstanceId: InstanceId; readonly amount: number }
  | {
      readonly kind: "placeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      readonly parentFrameId?: FrameId | null;
    }
  | {
      readonly kind: "removeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      readonly parentFrameId?: FrameId | null;
    }
  | {
      readonly kind: "attack";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly playerId: PlayerId;
      /** Damage for an "(attack)" ability; absent/null = the attacker's ATK (a basic attack). */
      readonly amount?: number | null;
      readonly basic?: boolean;
      readonly overkill?: boolean;
      /** The card whose ability made this attack (the event card for "Hero Action (attack)"). */
      readonly sourceInstanceId?: InstanceId | null;
    }
  | {
      readonly kind: "thwart";
      readonly thwarterInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly playerId: PlayerId;
      /** Threat removed by a "(thwart)" ability; absent/null = the thwarter's THW (a basic thwart). */
      readonly amount?: number | null;
      readonly basic?: boolean;
      readonly sourceInstanceId?: InstanceId | null;
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
      /** The player the attack was initiated against (RRG p.9: "attacks you" keys off this). */
      readonly attackedPlayerId: PlayerId;
      /** The player who ends up targeted — changes if another player defends. */
      readonly targetPlayerId: PlayerId;
      readonly targetInstanceId: InstanceId;
      /** The same attack resolved against another player (Whirlwind): the attacker's "when it attacks" abilities don't re-trigger. */
      readonly additionalResolution?: boolean;
      /** "That attack does not get a boost card" (Escaped Convict, I See You): step 1 deals nothing. */
      readonly noBoost?: boolean;
    }
  | { readonly kind: "enemyScheme"; readonly enemyInstanceId: InstanceId; readonly playerId: PlayerId; readonly noBoost?: boolean }
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
    }
  | { readonly kind: "cardEntersPlay"; readonly instanceId: InstanceId; readonly playerId: PlayerId | null }
  | { readonly kind: "cardPlayed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * A card has been paid for and is about to resolve: "When you play an [Attack] event" (Embiggen!, Shrink). An
   * interrupt here happens before the card's own abilities resolve, which is what lets a modifier apply to every
   * instance of damage the event deals. `cardPlayed` stays where it is — announced after the card has resolved — so
   * "after you play" responses are unaffected. Only put on the stack when an ability could react (`heard`).
   */
  | { readonly kind: "cardBeingPlayed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly kind: "cardRevealed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  /**
   * An ally or minion at 0 hit points is being defeated. Interruptible ("when
   * attached minion would be defeated … instead", "when attached minion is
   * defeated"); the card leaves play when it applies. `overkill` carries excess
   * damage from an overkill attack, dealt only if the defeat happens.
   */
  | {
      readonly kind: "characterDefeated";
      readonly instanceId: InstanceId;
      readonly parentFrameId?: FrameId | null;
      readonly overkill?: { readonly amount: number; readonly toInstanceId: InstanceId; readonly sourceInstanceId: InstanceId | null };
      /**
       * The player whose card dealt the defeating damage ("after *you* defeat a
       * minion"), when the defeat came from a damage event with a player-controlled
       * source. It is the event's player subject, so `playerIs: "controller"` matches it.
       */
      readonly defeatedByPlayerId?: PlayerId | null;
    }
  /** An encounter card has been flipped faceup and is about to resolve (RRG "Reveal"): the point to cancel it. */
  | { readonly kind: "encounterCardRevealing"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly kind: "schemeDefeated"; readonly instanceId: InstanceId }
  | { readonly kind: "villainStageAdvanced"; readonly stageIndex: number; readonly instanceId: InstanceId }
  | { readonly kind: "mainSchemeAdvanced"; readonly stageIndex: number }
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
  | { readonly kind: "abilityResolved"; readonly instanceId: InstanceId; readonly abilityId: AbilityId; readonly controllerId: PlayerId | null }
  /** A card (villain or double-sided encounter card) has flipped. An announcement: the flip has happened. */
  | { readonly kind: "cardFlipped"; readonly instanceId: InstanceId }
  /** A player changed form (by the once-per-round flip or a card effect): "after you change to this form". */
  | { readonly kind: "formChanged"; readonly playerId: PlayerId; readonly to: "hero" | "alterEgo" }
  | { readonly kind: "playerPhaseEnded" }
  | { readonly kind: "villainPhaseEnded" };

/**
 * `results` is attached when the event's response window opens: what the event
 * actually did (`amount`, and for attacks/activations `damage`, `damaged`,
 * `defeated`, `undefended`, `threatPlaced`, `threatRemoved`).
 */
export type TriggerEvent = TriggerEventBody & { readonly results?: Vars };

export type TriggerEventKind = TriggerEvent["kind"];

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
    case "characterAttacked":
    case "characterDefeated":
    case "encounterCardRevealing":
    case "boostCardTurnedFaceup":
    case "turnEnding":
    case "surgeResolving":
    case "cardBeingPlayed":
      return false;
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
    case "healDamage":
      return of([], [event.targetInstanceId], []);
    case "placeThreat":
    case "removeThreat":
      return of([event.sourceInstanceId], [event.schemeInstanceId], []);
    case "attack":
      return of([event.attackerInstanceId], [event.targetInstanceId], [event.playerId]);
    case "thwart":
      return of([event.thwarterInstanceId], [event.schemeInstanceId], [event.playerId]);
    case "enemyAttack":
      return of(
        [event.enemyInstanceId],
        [event.targetInstanceId],
        [event.attackedPlayerId, event.targetPlayerId],
      );
    case "enemyScheme":
      return of([event.enemyInstanceId], [], [event.playerId]);
    case "characterAttacked":
      return of([event.attackerInstanceId], [event.targetInstanceId], [event.playerId]);
    case "defended":
      return of([event.enemyInstanceId], [event.defenderInstanceId], [event.playerId]);
    case "cardEntersPlay":
    case "cardPlayed":
    case "cardBeingPlayed":
    case "cardRevealed":
    case "encounterCardRevealing":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    case "characterDefeated":
      return of([], [event.instanceId], [event.defeatedByPlayerId ?? null]);
    case "schemeDefeated":
    case "cardFlipped":
      return of([], [event.instanceId], []);
    case "boostCardTurnedFaceup":
      return of([event.enemyInstanceId], [event.boostInstanceId], [event.playerId]);
    case "turnStarted":
    case "formChanged":
    case "turnEnding":
      return of([], [], [event.playerId]);
    case "minionEngaged":
      return of([event.minionInstanceId], [event.minionInstanceId], [event.playerId]);
    case "surgeResolving":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    case "abilityResolved":
      return of([event.instanceId], [], [event.controllerId]);
    default:
      return of([], [], []);
  }
}
