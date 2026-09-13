/** The resolution stack's entry point: runs the top frame, and the resolve API the rest of the engine uses. */

import type { Ctx } from "../ctx.js";
import { EngineInvariantError } from "../errors.js";
import { executeAbilityFrame } from "./ability.js";
import { executeDamageGroupFrame } from "./damage-group.js";
import { executeEffectsFrame } from "./effects-frame.js";
import { executeEnemyAttackFrame, executeEnemySchemeFrame } from "./enemy-activation.js";
import { executeEventFrame } from "./event.js";
import { executePlayCardFrame } from "./play-card.js";
import { executeRevealFrame } from "./reveal.js";
import { executeWindowFrame } from "./window.js";

export { clearAbilityUses, recordAbilityUse } from "./ability.js";
export { selectCards, shuffleSeparateDeck } from "./cards.js";
export { checkDefeats, eliminatePlayer } from "./defeat.js";
export { legalDefenders } from "./enemy-activation.js";
export { applyEnterPlayKeywords } from "./enter-play.js";
export {
  addFrameSlots,
  addFrameVars,
  announce,
  gameAbilityFrames,
  pushActionAbility,
  pushEffects,
  pushEvent,
  pushEvents,
  pushGameAbilities,
} from "./frames.js";
export { pushPlayCardFrame } from "./play-card.js";
export { attachmentHostCandidates, enterPlayOnReveal, pushRevealFrame } from "./reveal.js";
export { heard } from "./triggers.js";

export function executeFrame(ctx: Ctx): void {
  const frame = ctx.state.stack[0];
  if (!frame) throw new EngineInvariantError("executeFrame with an empty stack");
  switch (frame.kind) {
    case "event":
      return executeEventFrame(ctx, frame);
    case "window":
      return executeWindowFrame(ctx, frame);
    case "ability":
      return executeAbilityFrame(ctx, frame);
    case "effects":
      return executeEffectsFrame(ctx, frame);
    case "enemyAttack":
      return executeEnemyAttackFrame(ctx, frame);
    case "enemyScheme":
      return executeEnemySchemeFrame(ctx, frame);
    case "reveal":
      return executeRevealFrame(ctx, frame);
    case "playCard":
      return executePlayCardFrame(ctx, frame);
    case "damageGroup":
      return executeDamageGroupFrame(ctx, frame);
  }
}
