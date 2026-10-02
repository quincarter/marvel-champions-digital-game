/**
 * "After you ignore guard / patrol / the crisis icon" (docs/phase7-wave6.md §3.8, §4.1 Q6): which cards' guard or
 * patrol keyword, or crisis icon, an attack or thwart ignored, recorded on its event frame as it applies and announced
 * once that frame finishes.
 */

import type { EngineDeps } from "../abilities.js";
import { type Ctx, updateFrame } from "../ctx.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import { areaOfCard, getInstance, isMinion, isVillain, sameGameArea } from "../query.js";
import { iconsOn } from "../rules.js";
import { cardsInPlay, characterIgnores, controllerOf, isProtectedMainScheme } from "../select.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import type { Frame } from "./frames.js";
import { pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";

export type KeywordIgnored = Extract<TriggerEvent, { kind: "keywordIgnored" }>;

const ignoredBy =
  (characterInstanceId: InstanceId, playerId: PlayerId, ignored: KeywordIgnored["ignored"]) =>
  (cardInstanceId: InstanceId): KeywordIgnored => ({
    kind: "keywordIgnored",
    characterInstanceId,
    playerId,
    ignored,
    cardInstanceId,
  });

/**
 * The guard minions a player's attack on `targetId` ignored: the attack is the attacker's controller's (RRG 1.8
 * "Guard", p. 21), against a villain without guard itself, and a `characterIgnores` rule exempts the attacker, so each
 * guard minion engaged with that controller would otherwise have stopped it (`canAttack`, `select.ts`).
 */
export function guardsIgnored(
  state: GameState,
  deps: EngineDeps,
  attackerId: InstanceId,
  targetId: InstanceId,
  playerId: PlayerId,
): readonly KeywordIgnored[] {
  const controller = controllerOf(state, attackerId);
  if (controller === null || !isVillain(state, targetId) || hasKeyword(state, targetId, "guard", deps)) return [];
  if (!characterIgnores(state, deps, attackerId, "guard")) return [];
  return cardsInPlay(state)
    .filter(
      (id) =>
        isMinion(state, id) &&
        getInstance(state, id)?.engagedWith === controller &&
        hasKeyword(state, id, "guard", deps),
    )
    .map(ignoredBy(attackerId, playerId, "guard"));
}

/** The thwart a threat removal belongs to, as `threatRemovalBlocked` (`resolve/event.ts`) reads it. */
interface ThwartRemoval {
  readonly thwart: Extract<TriggerEvent, { kind: "thwart" }>;
  readonly schemeInstanceId: InstanceId;
  /** The removal's own "ignoring any crisis icons in play". */
  readonly ignoreCrisis: boolean;
}

/**
 * The crisis icons and patrol minions a thwart's threat removal from the main scheme ignored, once that removal has
 * gone through (`threatRemovalBlocked` returned null): each card showing a crisis icon in the scheme's area, when the
 * thwarter's `characterIgnores` or the removal's "ignoring any crisis icons" waived it; each patrol minion engaged with
 * the thwarting player, when the thwarter's `characterIgnores` or the thwart's "ignoring the patrol keyword" waived it.
 */
export function thwartBlockersIgnored(state: GameState, deps: EngineDeps, removal: ThwartRemoval): KeywordIgnored[] {
  const { thwart, schemeInstanceId: schemeId } = removal;
  if (!isProtectedMainScheme(state, deps, schemeId)) return [];
  const thwarter = thwart.thwarterInstanceId;
  const basic = thwart.basic === true;
  const events: KeywordIgnored[] = [];
  if (removal.ignoreCrisis || characterIgnores(state, deps, thwarter, "crisis", basic)) {
    const area = areaOfCard(state, schemeId);
    events.push(
      ...cardsInPlay(state)
        .filter((id) => sameGameArea(area, areaOfCard(state, id)) && iconsOn(state, deps, id, "crisis") > 0)
        .map(ignoredBy(thwarter, thwart.playerId, "crisis")),
    );
  }
  if (thwart.ignorePatrol === true || characterIgnores(state, deps, thwarter, "patrol", basic)) {
    const player = state.players.find((p) => p.playerId === thwart.playerId);
    events.push(
      ...(player?.playArea ?? [])
        .filter((id) => isMinion(state, id) && hasKeyword(state, id, "patrol", deps))
        .map(ignoredBy(thwarter, thwart.playerId, "patrol")),
    );
  }
  return events;
}

/** Adds `events` to the attack or thwart event frame `frameId`, once per character, keyword and card. */
export function recordKeywordsIgnored(ctx: Ctx, frameId: FrameId, events: readonly KeywordIgnored[]): void {
  if (events.length === 0) return;
  updateFrame(ctx, frameId, (frame) => {
    if (frame.kind !== "event") return frame;
    const recorded = (frame.keywordsIgnored ?? []) as readonly KeywordIgnored[];
    const fresh = events.filter(
      (event) =>
        !recorded.some(
          (r) =>
            r.characterInstanceId === event.characterInstanceId &&
            r.ignored === event.ignored &&
            r.cardInstanceId === event.cardInstanceId,
        ),
    );
    return fresh.length === 0 ? frame : { ...frame, keywordsIgnored: [...recorded, ...fresh] };
  });
}

/**
 * Announces a finished frame's `keywordsIgnored`, the ones an ability listens to, in one shared response window (RRG
 * 1.8 "Triggering Condition", p. 45; as `announceStatusDiscarded`). With nothing listening nothing is pushed.
 */
export function announceKeywordsIgnored(ctx: Ctx, frame: Frame<"event">): void {
  const listened = (frame.keywordsIgnored ?? []).filter((event) => heard(ctx.state, ctx.deps, event));
  if (listened.length > 0) pushEventsSharingResponses(ctx, listened);
}
