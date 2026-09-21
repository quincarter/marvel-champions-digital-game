/**
 * The card a pending choice is actually about, ready to *show* — not just name.
 *
 * Reported problem: "when a popup enters and we have to decide to choose a card for an action to resolve — i.e. a
 * hero response is to discard a card, or a villain attacks and i can pay for a card to interrupt, i can't see the
 * card that i am acting on or paying for alongside or inside of the popup." `view/choice-source.ts` already finds
 * *which* card (and, where it can be pinned down, which ability) a choice traces back to, for the choice sheet's
 * header line — but the header only ever draws a name and a 32px thumbnail. This module turns that same source into
 * everything a real card panel needs: its art, its name, its type line, its full current rules text, and — when the
 * prompt says so — the specific ability and cost in play ("Paying 2 for Backflip").
 *
 * Deliberately thin: every field here is `inspectModel`'s own (the same content/state that already renders the
 * Inspect overlay's card face), so a source panel and Inspect can never disagree about what a card says. This module
 * adds nothing but the choice-specific `abilityLine`.
 */

import type { AbilityId } from "@mc/content";
import {
  activeAbilityRefs,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";
import type { ArtSource } from "../art/art-source.js";
import { choiceSourceOf, type ChoiceSource } from "./choice-source.js";
import { inspectModel, triggerLabel } from "./inspect-model.js";
import { cardName } from "./names.js";

/** Everything a source-card panel draws — a card, ready to render, not just named. */
export interface ChoiceSourcePanel {
  readonly instanceId: InstanceId;
  readonly art: ArtSource | null;
  readonly name: string;
  /** "Event · Attack · Justice" — `inspectModel`'s own, unchanged. */
  readonly typeLine: string;
  readonly rulesText: string;
  /**
   * "Paying 2 for Backflip", "Response — Discard" — the specific ability and cost this choice is about, when the
   * prompt or the traced-back ability says so. Null when there's nothing beyond the card's own printed text to add
   * (most `chooseTarget`/`chooseCards` prompts sourced from a card with no single active ability, an `enemyAttack`/
   * `enemyScheme` activation, or a played/revealed card with no triggered ability).
   */
  readonly abilityLine: string | null;
}

/**
 * A source-card panel for a specific, already-known instance — the shape `choiceSourcePanelOf` returns, built
 * directly rather than traced back through `choiceSourceOf`. The villain-phase inline interrupt uses this for the
 * enemy actually activating (`ActivationBeat.enemyInstanceId`, which it already tracks beat by beat), because that
 * is a more precise answer to "what is this window about" than a `window` `StackFrame`'s own candidate — which
 * names one of the player's *own* interruptible cards, not the thing being interrupted (see `choice-source.ts`'s
 * own "KNOWN GAP" for why the frame can't yet say more).
 */
export function sourceCardPanelFor(
  state: GameState,
  instanceId: InstanceId,
  perspectiveId: PlayerId,
  deps: EngineDeps,
  abilityLine: string | null = null,
): ChoiceSourcePanel {
  const model = inspectModel(state, instanceId, null, perspectiveId, deps);
  return {
    instanceId,
    art: model.art,
    name: model.name,
    typeLine: model.typeLine,
    rulesText: model.rulesText,
    abilityLine,
  };
}

/**
 * The pending choice's own source card, panel-ready. Null exactly when `choiceSourceOf` is — a phase-owned choice
 * with no single source (a mulligan, discard to hand size).
 */
export function choiceSourcePanelOf(
  state: GameState,
  choice: PendingChoice,
  perspectiveId: PlayerId,
  deps: EngineDeps,
): ChoiceSourcePanel | null {
  const source = choiceSourceOf(state, choice);
  if (!source) return null;
  return sourceCardPanelFor(state, source.instanceId, perspectiveId, deps, abilityLineFor(state, choice, source, deps));
}

/**
 * "Paying 2 for Backflip" when the prompt itself is the payment (`payForCard`/`payForAbility` already carry their
 * own `cost` — full fidelity, straight off the engine, same as `choice-source.ts`'s own header text). Otherwise,
 * when the traced-back card's one active ability is known, its structural trigger header ("Response", "Forced
 * Interrupt", …), plus the card's own printed sub-ability label when it has one ("Response — Discard"). Null
 * otherwise — never an invented description of what the ability *does*.
 */
function abilityLineFor(
  state: GameState,
  choice: PendingChoice,
  source: ChoiceSource,
  deps: EngineDeps,
): string | null {
  const { prompt } = choice;
  if ((prompt.kind === "payForCard" || prompt.kind === "payForAbility") && prompt.instanceId === source.instanceId) {
    return `Paying ${prompt.cost} for ${abilityDisplayName(state, source.instanceId, prompt.abilityId, deps)}`;
  }
  if (!source.abilityId) return null;
  const trigger = deps.abilities[source.abilityId]?.trigger;
  if (!trigger) return null;
  const printed = activeAbilityRefs(state, source.instanceId).find((ref) => ref.id === source.abilityId)?.label;
  return printed ? `${triggerLabel(trigger)} — ${printed}` : triggerLabel(trigger);
}

/** The name to put after "Paying N for …": the card's own printed sub-ability label, else its structural trigger header, else just the card's name. */
function abilityDisplayName(state: GameState, instanceId: InstanceId, abilityId: AbilityId, deps: EngineDeps): string {
  const printed = activeAbilityRefs(state, instanceId).find((ref) => ref.id === abilityId)?.label;
  if (printed) return printed;
  const trigger = deps.abilities[abilityId]?.trigger;
  return trigger ? triggerLabel(trigger) : cardName(state, instanceId);
}
