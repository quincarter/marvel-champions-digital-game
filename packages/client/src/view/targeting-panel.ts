/**
 * The targeting panel (docs/phase4-screen-gaps.md §3 "W5"; design canvases D09, L06): what the board's existing
 * target-select mode (`scenes/board/controller.ts`'s `Selection.kind === "targeting"`) shows once a pulsing ring on
 * the board isn't enough on its own — each legal target's outcome, and why every other card in play isn't one.
 *
 * Every number is the engine's own `preview()` (docs/phase4-screen-gaps.md §2 "S5.1–S5.3"); every "why not" reason
 * is the engine's own — `LegalAction.blockedTargets`' already-worded `message` for a basic attack/thwart or an
 * action ability, or `choiceExclusions`' bare `ExclusionCode` (worded through `highlights.ts`'s own table) for a
 * pending `chooseTarget`/`declareDefender`. This module computes no rule of its own: it builds the exact command a
 * dispatch would use (the caller passes `buildCommand`, since the actual re-aiming logic — `retarget` — already
 * lives in `scenes/board/selection.ts`, and a `view/*` module must not import from `scenes/*`), reads what the
 * engine says would happen, and words it — mostly `view/log-lines.ts`'s own phrasing in the future tense, per
 * docs/phase4-screen-gaps.md's S5.2 note that a preview panel is "mostly `logLine` in the future tense".
 */

import {
  cardOf,
  preview,
  type BlockedTarget,
  type ChoiceExclusion,
  type Command,
  type EngineDeps,
  type ExclusionCode,
  type GameEvent,
  type GameState,
  type InstanceId,
  type LegalAction,
  type OutcomePreview,
  type PreviewCounter,
  type PreviewStop,
} from "@mc/engine";
import { artFor, type ArtSource } from "../art/art-source.js";
import { faceOf } from "./board-model.js";
import { exclusionWording } from "./highlights.js";
import { cardName } from "./names.js";

/** One legal target, aimed at and worded. */
export interface TargetOption {
  readonly instanceId: InstanceId;
  readonly name: string;
  /** What choosing this target does, worded from the engine's own preview — never a rule restated. */
  readonly lines: readonly string[];
  /** The line the panel shows for this target while it is hovered or focused. */
  readonly confirmLine: string;
  /** The target's own scan, the same `ArtSource` every other card-shaped panel on the board draws — never this module's own placeholder. */
  readonly art: ArtSource | null;
}

/** A card instance's own scan, face-aware — shared by a target tile and the inspector rail so neither draws a placeholder the rest of the board wouldn't. */
function artOf(state: GameState, instanceId: InstanceId): ArtSource | null {
  return artFor(cardOf(state, instanceId), faceOf(state, instanceId));
}

/** One reason a card in play was left off the target list, and everyone it applies to. */
export interface ExcludedGroup {
  readonly code: string;
  readonly label: string;
  readonly names: readonly string[];
}

/** The card or character behind the action, so the tablet inspector rail (L06) has something to show beside the target list. */
export interface TargetingSource {
  /** "Photon Blast — deal 5 damage to an enemy" for an ability; "Spider-Man — Attack 4" for a basic action. */
  readonly label: string;
  /** Just the card's own name, for the rail's heading — `label` already folds this in, but with the stat/ability tacked on. */
  readonly name: string;
  /** The ability's own card, or the attacker/thwarter for a basic action — never null, since every `ActionRef` this panel opens for names one. */
  readonly instanceId: InstanceId;
}

export interface TargetingPanel {
  readonly title: string;
  /** `source` plus its own scan — computed here, not by the caller, since every card's art already comes from `state` the same way `optionOf`'s does. */
  readonly source: TargetingSource & { readonly art: ArtSource | null };
  readonly options: readonly TargetOption[];
  readonly excluded: readonly ExcludedGroup[];
}

/**
 * Builds the panel for the board's live target-select mode. `source` is built by the caller
 * (`scenes/board/controller.ts`), which already has `view/ability-label.ts` and `view/board-model.ts` for naming
 * the attacker/thwarter/ability; `buildCommand` is `scenes/board/selection.ts`'s `retarget` partially applied to
 * the selected `LegalAction.example`, so the exact command a real dispatch would send is what gets previewed —
 * never a second, hand-rolled copy of it.
 */
export function targetingPanelOf(
  state: GameState,
  action: LegalAction,
  source: TargetingSource,
  buildCommand: (target: InstanceId) => Command,
  deps: EngineDeps,
): TargetingPanel {
  const options = action.targets.map((instanceId) =>
    optionOf(state, instanceId, preview(state, buildCommand(instanceId), deps)),
  );
  return {
    title: "Choose a target",
    source: { ...source, art: artOf(state, source.instanceId) },
    options,
    excluded: groupBlockedByMessage(action.blockedTargets, (id) => cardName(state, id)),
  };
}

function optionOf(state: GameState, instanceId: InstanceId, result: OutcomePreview): TargetOption {
  const lines = outcomeLines(result, (id) => cardName(state, id), instanceId);
  return {
    instanceId,
    name: cardName(state, instanceId),
    lines,
    confirmLine: confirmLineOf(lines),
    art: artOf(state, instanceId),
  };
}

/**
 * Groups `LegalAction.blockedTargets` by the engine's own message, since its `reason` code is coarse (mostly
 * `no_valid_target`) but its `message` is already specific. Exposed for tests: everything it needs is either on
 * `BlockedTarget` or handed in as `nameOf`, so it needs no `GameState` of its own.
 */
export function groupBlockedByMessage(
  blocked: readonly BlockedTarget[],
  nameOf: (id: InstanceId) => string,
): readonly ExcludedGroup[] {
  const byMessage = new Map<string, { readonly code: string; readonly names: string[] }>();
  for (const entry of blocked) {
    const bucket = byMessage.get(entry.message) ?? { code: entry.reason, names: [] };
    bucket.names.push(nameOf(entry.instanceId));
    byMessage.set(entry.message, bucket);
  }
  return [...byMessage.entries()].map(([label, { code, names }]) => ({ code, label, names }));
}

/**
 * The same grouping for a pending `chooseTarget`/`declareDefender` choice's `choiceExclusions` — bare codes, worded
 * through `highlights.ts`'s table rather than a message the engine doesn't provide for these. No live caller wires
 * this into a screen yet (see the module doc comment); it is built and tested so the next screen that opens a
 * `chooseTarget` through a panel like this one has nothing left to word.
 */
export function excludedGroupsOf(state: GameState, exclusions: readonly ChoiceExclusion[]): readonly ExcludedGroup[] {
  return groupExclusionsByCode(exclusions, (id) => cardName(state, id));
}

/** `excludedGroupsOf`, minus the `GameState` — exposed for tests the same way `groupBlockedByMessage` is. */
export function groupExclusionsByCode(
  exclusions: readonly ChoiceExclusion[],
  nameOf: (id: InstanceId) => string,
): readonly ExcludedGroup[] {
  const byCode = new Map<ExclusionCode, string[]>();
  for (const entry of exclusions) {
    const names = byCode.get(entry.reason) ?? [];
    names.push(nameOf(entry.instanceId));
    byCode.set(entry.reason, names);
  }
  return [...byCode.entries()].map(([code, names]) => ({ code, label: exclusionWording(code), names }));
}

/**
 * Exposed for tests: the wording for one target's preview, independent of any `GameState` — everything it needs is
 * either on `OutcomePreview` itself or handed in as `nameOf`, so this can be tested against hand-built
 * `OutcomePreview` fixtures without running the engine at all (the engine already proves `preview`'s own
 * correctness; this only proves the wording is right once `preview` has spoken).
 */
export function outcomeLines(
  result: OutcomePreview,
  nameOf: (id: InstanceId) => string,
  primaryId: InstanceId,
): readonly string[] {
  if (result.stop.kind === "rejected") return [result.stop.message];

  const lines: string[] = [];
  const seen = new Set<InstanceId>();
  const order = [primaryId, ...result.counters.map((counter) => counter.instanceId)];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const counter = result.counters.find((candidate) => candidate.instanceId === id);
    if (!counter) continue;
    // The primary target is already named by the tile it's under; a secondary instance the effect also touched
    // (Photon Blast's own "if that enemy is a minion, deal 2 damage to another enemy") is named inline.
    const prefix = id === primaryId ? null : nameOf(id);
    for (const line of counterOutcome(counter, result.events)) lines.push(prefix ? `${prefix}: ${line}` : line);
  }
  const caveat = stopCaveat(result.stop);
  if (caveat) lines.push(caveat);
  return lines;
}

/** One instance's before/after, worded the way `view/log-lines.ts` already words the same facts once they've happened. */
function counterOutcome(counter: PreviewCounter, events: readonly GameEvent[]): readonly string[] {
  const { instanceId: id, before, after } = counter;
  const lines: string[] = [];

  const defeated = events.some(
    (event) => (event.type === "characterDefeated" || event.type === "schemeDefeated") && event.instanceId === id,
  );

  if (before.remainingHitPoints !== null) {
    if (defeated || !after.inPlay) {
      lines.push(`${before.remainingHitPoints} HP → Defeated`);
    } else if (after.remainingHitPoints !== null && after.remainingHitPoints !== before.remainingHitPoints) {
      lines.push(`${before.remainingHitPoints} HP → ${after.remainingHitPoints} HP`);
    }

    if (
      events.some(
        (event) => event.type === "damagePrevented" && event.targetInstanceId === id && event.reason === "tough",
      )
    ) {
      lines.push("Toughness absorbed it.");
    }

    const overkill = events.find((event) => event.type === "overkillSpilled" && event.fromInstanceId === id);
    if (overkill?.type === "overkillSpilled") {
      lines.push(`Overkill: ${overkill.amount} spills over.`);
    } else if (defeated) {
      const dealt = events.reduce(
        (sum, event) => (event.type === "damageDealt" && event.targetInstanceId === id ? sum + event.amount : sum),
        0,
      );
      const wasted = dealt - before.remainingHitPoints;
      if (wasted > 0) lines.push(`No overkill, so ${wasted} was lost.`);
    }
  }

  if (before.threat !== null) {
    if (defeated) lines.push("Cleared.");
    else if (after.threat !== null && after.threat !== before.threat)
      lines.push(`${before.threat} threat → ${after.threat} threat`);
  }

  return lines;
}

/**
 * The three honest caveats a preview can carry (docs/phase4-screen-gaps.md §2 "S5.3"): a nested target choice still
 * to come, an optional response/interrupt window this preview shows the no-response outcome of, or hidden
 * information the deciding player may not see. `complete` and `rejected` need no caveat — `rejected` already
 * produced its one line above, in `outcomeLines`.
 */
function stopCaveat(stop: PreviewStop): string | null {
  switch (stop.kind) {
    case "complete":
    case "rejected":
      return null;
    case "hiddenInformation":
      return "Depends on hidden cards.";
    case "choice":
      // RRG 1.8 p. 5's simultaneous timing priority: a preview is what happens if nobody responds.
      if (stop.prompt.kind === "chooseTriggers") return "If nobody responds.";
      if (stop.prompt.kind === "chooseTarget" || stop.prompt.kind === "chooseAttachmentTarget")
        return "…then you'll choose a target.";
      return "…then a further choice.";
  }
}

function confirmLineOf(lines: readonly string[]): string {
  return lines.length > 0 ? `Click to confirm · ${lines.join(" ")}` : "Click to confirm.";
}
