import type { InstanceId, PlayerId } from "./ids.js";

/**
 * Something that happens in the game and that abilities can hook. Every one of
 * these gets an `interrupt` window before it and a `response` window after it
 * when it resolves through the stack (RRG "Ability: Simultaneous Timing
 * Priority").
 */
export type TriggerEvent =
  | {
      readonly kind: "dealDamage";
      readonly targetInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
      /** Damage from an attack; defense, retaliate and overkill (slice 3) key off this. */
      readonly fromAttack: boolean;
    }
  | { readonly kind: "healDamage"; readonly targetInstanceId: InstanceId; readonly amount: number }
  | {
      readonly kind: "placeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | {
      readonly kind: "removeThreat";
      readonly schemeInstanceId: InstanceId;
      readonly amount: number;
      readonly sourceInstanceId: InstanceId | null;
    }
  | {
      readonly kind: "attack";
      readonly attackerInstanceId: InstanceId;
      readonly targetInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  | {
      readonly kind: "thwart";
      readonly thwarterInstanceId: InstanceId;
      readonly schemeInstanceId: InstanceId;
      readonly playerId: PlayerId;
    }
  | {
      readonly kind: "enemyAttack";
      readonly enemyInstanceId: InstanceId;
      /** The player the attack was initiated against (RRG p.9: "attacks you" keys off this). */
      readonly attackedPlayerId: PlayerId;
      /** The player who ends up targeted — changes if another player defends. */
      readonly targetPlayerId: PlayerId;
      readonly targetInstanceId: InstanceId;
    }
  | { readonly kind: "enemyScheme"; readonly enemyInstanceId: InstanceId; readonly playerId: PlayerId }
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
  | { readonly kind: "cardRevealed"; readonly instanceId: InstanceId; readonly playerId: PlayerId }
  | { readonly kind: "characterDefeated"; readonly instanceId: InstanceId }
  | { readonly kind: "schemeDefeated"; readonly instanceId: InstanceId }
  | { readonly kind: "villainStageAdvanced"; readonly stageIndex: number }
  | { readonly kind: "mainSchemeAdvanced"; readonly stageIndex: number }
  | { readonly kind: "turnStarted"; readonly playerId: PlayerId }
  | { readonly kind: "playerPhaseEnded" }
  | { readonly kind: "villainPhaseEnded" };

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
    case "cardEntersPlay":
    case "cardPlayed":
    case "cardRevealed":
      return of([event.instanceId], [event.instanceId], [event.playerId]);
    case "characterDefeated":
    case "schemeDefeated":
      return of([], [event.instanceId], []);
    case "turnStarted":
      return of([], [], [event.playerId]);
    default:
      return of([], [], []);
  }
}
