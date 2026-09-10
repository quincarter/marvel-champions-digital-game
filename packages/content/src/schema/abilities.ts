import type { AbilityId } from "./ids.js";

/**
 * Trigger classification lets the engine index/register an ability's timing
 * window before the ability-scripting-engineer has written the executable
 * definition behind it. This schema never encodes *behavior* — only enough
 * metadata for the engine to know an ability exists and when it can fire.
 */
export type AbilityTrigger =
  | "action"
  | "response"
  | "interrupt"
  | "forced_response"
  | "forced_interrupt"
  | "when_revealed"
  | "constant"
  | "setup"
  | "boost_effect";

/**
 * An opaque handle into the (not-yet-written) ability script registry, plus
 * enough context for a human or the ability-scripting-engineer to find and
 * implement it later. `notesForScripting` is the "describe what the ability
 * needs to do in plain terms" handoff called for in this agent's brief — it
 * is documentation, not a game-logic encoding.
 */
export interface AbilityReference {
  readonly id: AbilityId;
  readonly trigger: AbilityTrigger;
  readonly notesForScripting?: string;
}
